import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { createAdminChildrenService } from "./admin-children-service";
import { createSanitizedPilotState } from "./fixtures";
import type { PilotState } from "./models";
import { sandboxIdentity, SESSION_COOKIE } from "./server-auth";

function inMemoryRepository(initial: PilotState) {
  let state = structuredClone(initial);
  return {
    readState: async () => structuredClone(state),
    updateState: async <T>(mutation: (current: PilotState) => T | Promise<T>) => {
      const next = structuredClone(state);
      const result = await mutation(next);
      state = next;
      return result;
    },
    current: () => state
  };
}

function requestFor(userId: string) {
  return new NextRequest("https://pilot.example.test/api/admin/children", {
    headers: { cookie: `${SESSION_COOKIE}=${sandboxIdentity.issue(userId)}` }
  });
}

describe("admin children service", () => {
  it("projects the full roster to Admins only", async () => {
    const repository = inMemoryRepository(createSanitizedPilotState());
    const service = createAdminChildrenService(repository);

    const projection = await service.projection(requestFor("user-admin-1"));
    expect(projection.children.length).toBeGreaterThan(0);
    expect(projection.educators.every((educator) => educator.role === "EDUCATOR")).toBe(true);
    expect(projection.actorId).toBe("user-admin-1");

    await expect(service.projection(requestFor("user-educator-1"))).rejects.toThrow("unavailable");
  });

  it("creates children with a unique identifier and records a support event", async () => {
    const repository = inMemoryRepository(createSanitizedPilotState());
    const service = createAdminChildrenService(repository);
    const request = requestFor("user-admin-1");

    const created = await service.mutate(request, {
      action: "CREATE_CHILD",
      externalChildId: "Child 2001",
      ageMonths: 14,
      supportContext: "IFSP",
      contextLabel: "IFSP: Yes",
      processingAllowed: true
    });
    expect(created).toMatchObject({
      child: { externalChildId: "Child 2001", ageMonths: 14, contextSource: "SANITIZED_ADMIN", isActive: true }
    });
    expect(repository.current().supportEvents?.some(
      (event) => event.type === "CHILD_CHANGED" && event.subjectId === (created as { child: { id: string } }).child.id
    )).toBe(true);

    const duplicate = await service.mutate(request, {
      action: "CREATE_CHILD",
      externalChildId: "Child 2001",
      ageMonths: 20,
      supportContext: "UNKNOWN",
      contextLabel: null,
      processingAllowed: false
    });
    expect(duplicate).toMatchObject({ blocked: true, reason: expect.stringContaining("already exists") });
  });

  it("edits child fields and rejects renaming onto an existing identifier", async () => {
    const repository = inMemoryRepository(createSanitizedPilotState());
    const service = createAdminChildrenService(repository);
    const request = requestFor("user-admin-1");

    const edited = await service.mutate(request, {
      action: "EDIT_CHILD",
      childId: "child-1001",
      ageMonths: 21,
      contextLabel: "Updated context"
    });
    expect(edited).toMatchObject({
      child: { id: "child-1001", ageMonths: 21, contextLabel: "Updated context", contextSource: "SANITIZED_ADMIN" }
    });

    const collision = await service.mutate(request, {
      action: "EDIT_CHILD",
      childId: "child-1001",
      externalChildId: "Child 1024"
    });
    expect(collision).toMatchObject({ blocked: true });
  });

  it("deactivating a child removes its active assignments; reactivation does not restore them", async () => {
    const repository = inMemoryRepository(createSanitizedPilotState());
    const service = createAdminChildrenService(repository);
    const request = requestFor("user-admin-1");

    await service.mutate(request, { action: "SET_CHILD_ACTIVE", childId: "child-1001", active: false });
    expect(repository.current().children.find((child) => child.id === "child-1001")?.isActive).toBe(false);
    expect(repository.current().assignments.filter(
      (assignment) => assignment.childId === "child-1001" && assignment.active
    )).toHaveLength(0);

    await service.mutate(request, { action: "SET_CHILD_ACTIVE", childId: "child-1001", active: true });
    expect(repository.current().children.find((child) => child.id === "child-1001")?.isActive).toBe(true);
    expect(repository.current().assignments.filter(
      (assignment) => assignment.childId === "child-1001" && assignment.active
    )).toHaveLength(0);
  });

  it("rejects mutations from non-admin actors and unknown children", async () => {
    const repository = inMemoryRepository(createSanitizedPilotState());
    const service = createAdminChildrenService(repository);

    await expect(service.mutate(requestFor("user-educator-1"), {
      action: "SET_CHILD_ACTIVE",
      childId: "child-1001",
      active: false
    })).rejects.toThrow("unavailable");

    await expect(service.mutate(requestFor("user-admin-1"), {
      action: "SET_CHILD_ACTIVE",
      childId: "child-none",
      active: false
    })).rejects.toThrow("unavailable");
  });
});
