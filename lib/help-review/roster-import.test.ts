import { describe, expect, it } from "vitest";

import { createSanitizedPilotState } from "./fixtures";
import type { PilotState } from "./models";
import { contextSnapshotForChild } from "./processing-coordinator";
import {
  createRosterImportService,
  RosterImportValidationError
} from "./roster-import";

const HEADER = "child_external_id,age_months,support_context,context_label,processing_allowed,child_active,educator_email,assignment_active";

function harness(initial = createSanitizedPilotState()) {
  let state = structuredClone(initial);
  let nextId = 1;
  const service = createRosterImportService({
    readState: async () => structuredClone(state),
    updateState: async <T>(mutation: (candidate: PilotState) => T | Promise<T>) => {
      const candidate = structuredClone(state);
      const result = await mutation(candidate);
      state = candidate;
      return result;
    },
    now: () => "2026-07-15T17:00:00.000Z",
    id: () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`
  });
  return { service, state: () => state };
}

describe("controlled roster import", () => {
  it("previews a valid import without mutating authoritative state", async () => {
    const { service, state } = harness();
    const before = structuredClone(state());
    const csv = `${HEADER}\nChild 2001,24,IFSP,"IFSP: Yes, current",true,true,alex.educator@example.test,true\n`;

    const summary = await service.run(csv, { actorId: "user-admin-1", dryRun: true });

    expect(summary).toMatchObject({
      dryRun: true,
      replayed: false,
      rows: 1,
      childrenCreated: 1,
      assignmentsCreated: 1
    });
    expect(state()).toEqual(before);
  });

  it("applies, audits, and safely replays one child and assignment", async () => {
    const { service, state } = harness();
    const csv = `${HEADER}\nChild 2001,24,IFSP,"IFSP: Yes, current",true,true,alex.educator@example.test,true\n`;

    const first = await service.run(csv, { actorId: "user-admin-1", dryRun: false });
    const replay = await service.run(csv, { actorId: "user-admin-1", dryRun: false });

    const child = state().children.find((candidate) => candidate.externalChildId === "Child 2001");
    expect(first).toMatchObject({ childrenCreated: 1, assignmentsCreated: 1, replayed: false });
    expect(replay).toMatchObject({ childrenCreated: 0, assignmentsCreated: 0, replayed: true });
    expect(child).toMatchObject({
      supportContext: "IFSP",
      contextLabel: "IFSP: Yes, current",
      contextSource: "ROSTER_ADAPTER",
      processingAllowed: true,
      isActive: true
    });
    expect(contextSnapshotForChild(child!)).toMatchObject({
      supportContext: "IFSP",
      source: "ROSTER_ADAPTER"
    });
    expect(state().assignments.filter((assignment) => assignment.childId === child?.id)).toHaveLength(1);
    expect(state().supportEvents?.filter((event) => event.type === "ROSTER_IMPORTED")).toHaveLength(1);
  });

  it("updates context and revokes every assignment when a child is explicitly inactive", async () => {
    const { service, state } = harness();
    const csv = `${HEADER}\nChild 1001,20,DISABILITY,Disability documented,false,false,,\n`;

    const summary = await service.run(csv, { actorId: "user-admin-1", dryRun: false });

    const child = state().children.find((candidate) => candidate.externalChildId === "Child 1001");
    expect(summary).toMatchObject({
      childrenUpdated: 1,
      childrenDeactivated: 1,
      assignmentsDeactivated: 1
    });
    expect(child).toMatchObject({
      ageMonths: 20,
      supportContext: "DISABILITY",
      processingAllowed: false,
      isActive: false
    });
    expect(state().assignments.filter((assignment) => assignment.childId === child?.id && assignment.active)).toEqual([]);
  });

  it("allows repeated child rows only for distinct assignments with identical context", async () => {
    const { service, state } = harness();
    const csv = [
      HEADER,
      "Child 2002,30,NONE_REPORTED,,true,true,alex.educator@example.test,true",
      "Child 2002,30,NONE_REPORTED,,true,true,jordan.educator@example.test,true"
    ].join("\n");

    const summary = await service.run(csv, { actorId: "user-admin-1", dryRun: false });
    const child = state().children.find((candidate) => candidate.externalChildId === "Child 2002");

    expect(summary).toMatchObject({ rows: 2, childrenCreated: 1, assignmentsCreated: 2 });
    expect(state().assignments.filter((assignment) => assignment.childId === child?.id && assignment.active)).toHaveLength(2);
  });

  it("rejects conflicting child rows and duplicate assignment pairs before writing", async () => {
    const { service, state } = harness();
    const before = structuredClone(state());
    const csv = [
      HEADER,
      "Child 2003,20,NONE_REPORTED,,true,true,alex.educator@example.test,true",
      "Child 2003,21,IFSP,IFSP: Yes,true,true,alex.educator@example.test,true"
    ].join("\n");

    await expect(service.run(csv, { actorId: "user-admin-1", dryRun: false })).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "CONFLICTING_CHILD", row: 3 }),
        expect.objectContaining({ code: "DUPLICATE_ASSIGNMENT", row: 3 })
      ])
    });
    expect(state()).toEqual(before);
  });

  it("rejects unknown or inactive educators without echoing cell values", async () => {
    const initial = createSanitizedPilotState();
    initial.access.find((access) => access.userId === "user-educator-1")!.active = false;
    const { service } = harness(initial);
    const csv = [
      HEADER,
      "Child 2004,22,UNKNOWN,,true,true,unknown-person@example.test,true",
      "Child 2005,22,UNKNOWN,,true,true,alex.educator@example.test,true"
    ].join("\n");

    try {
      await service.run(csv, { actorId: "user-admin-1", dryRun: false });
      throw new Error("Expected validation failure.");
    } catch (error) {
      expect(error).toBeInstanceOf(RosterImportValidationError);
      const validation = error as RosterImportValidationError;
      expect(validation.issues.map((candidate) => candidate.code)).toEqual(["UNKNOWN_EDUCATOR", "INACTIVE_EDUCATOR"]);
      expect(JSON.stringify(validation.issues)).not.toContain("unknown-person@example.test");
      expect(JSON.stringify(validation.issues)).not.toContain("alex.educator@example.test");
    }
  });

  it("rejects malformed headers, values, inactive assignments, and inactive Admin actors", async () => {
    const { service } = harness();
    await expect(service.run("wrong_header\nvalue\n", { actorId: "user-admin-1", dryRun: true })).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ code: "UNKNOWN_HEADER" })])
    });
    await expect(service.run(
      `${HEADER}\nChild 2006,90,UNKNOWN,,yes,false,alex.educator@example.test,true\n`,
      { actorId: "user-admin-1", dryRun: true }
    )).rejects.toBeInstanceOf(RosterImportValidationError);
    await expect(service.run(
      `${HEADER}\nChild 2007,20,UNKNOWN,,true,true,,\n`,
      { actorId: "user-educator-1", dryRun: true }
    )).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "INVALID_ACTOR" })]
    });
  });
});
