import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AccessError, activeUserFromState } from "@/lib/help-review/server-auth";
import { recordSupportEvent } from "@/lib/help-review/server-events";
import { assertSameOrigin, routeError, validationError } from "@/lib/help-review/server-http";
import { readPilotState, updatePilotState } from "@/lib/help-review/server-store";

const AccessMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("PROVISION_STAFF"),
    email: z.email().max(254),
    displayName: z.string().trim().min(2).max(100),
    role: z.enum(["EDUCATOR", "ADMIN"])
  }).strict(),
  z.object({ action: z.literal("SET_ACCESS"), userId: z.string().min(1), active: z.boolean() }).strict(),
  z.object({ action: z.literal("SET_ASSIGNMENT"), userId: z.string().min(1), childId: z.string().min(1), active: z.boolean() }).strict()
]);

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const state = await readPilotState();
    const actor = activeUserFromState(request, state);
    if (actor.role !== "ADMIN") return NextResponse.json({ error: "Resource unavailable." }, { status: 404 });
    return NextResponse.json({
      staff: state.users,
      children: state.children.filter((child) => child.isActive),
      access: state.access,
      assignments: state.assignments,
      actorId: actor.id
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = AccessMutationSchema.safeParse(await request.json());
    if (!parsed.success) return validationError("The access change is invalid.");
    const mutation = parsed.data;
    const result = await updatePilotState((state) => {
      const actor = activeUserFromState(request, state);
      if (actor.role !== "ADMIN") throw new AccessError("The requested resource is unavailable.");
      const now = new Date().toISOString();
      if (mutation.action === "PROVISION_STAFF") {
        const exactEmail = mutation.email.trim().toLowerCase();
        let educator = state.users.find((user) => user.email.toLowerCase() === exactEmail);
        if (educator && educator.role !== mutation.role) {
          return { blocked: true as const, reason: "That identity is already provisioned with a different role." };
        }
        if (!educator) {
          educator = {
            id: `user-${randomUUID()}`,
            externalSubject: `sandbox:${randomUUID()}`,
            email: exactEmail,
            displayName: mutation.displayName.trim(),
            role: mutation.role,
            isActive: true
          };
          state.users.push(educator);
        }
        let provision = state.access.find((candidate) => candidate.userId === educator.id);
        if (!provision) {
          provision = {
            id: `access-${randomUUID()}`,
            exactEmail,
            userId: educator.id,
            role: mutation.role,
            active: true,
            updatedAt: now,
            updatedById: actor.id
          };
          state.access.push(provision);
        } else {
          provision.active = true;
          provision.updatedAt = now;
          provision.updatedById = actor.id;
        }
        recordSupportEvent(state, {
          type: "ACCESS_CHANGED",
          actorId: actor.id,
          subjectId: educator.id,
          referenceId: provision.id,
          occurredAt: now
        });
        return { educator, access: provision };
      }
      const educator = state.users.find((user) => user.id === mutation.userId);
      if (!educator) throw new Error("Access change references an unknown staff member.");
      if (mutation.action === "SET_ACCESS") {
        if (educator.id === actor.id && !mutation.active) {
          throw new AccessError("An Admin cannot deactivate their own active session.", 403);
        }
        let provision = state.access.find((candidate) => candidate.userId === educator.id);
        if (!provision) {
          provision = {
            id: `access-${randomUUID()}`,
            exactEmail: educator.email,
            userId: educator.id,
            role: educator.role,
            active: mutation.active,
            updatedAt: now,
            updatedById: actor.id
          };
          state.access.push(provision);
        } else {
          provision.active = mutation.active;
          provision.updatedAt = now;
          provision.updatedById = actor.id;
        }
        recordSupportEvent(state, {
          type: "ACCESS_CHANGED",
          actorId: actor.id,
          subjectId: educator.id,
          referenceId: provision.id,
          occurredAt: now
        });
        return { access: provision };
      }
      if (!("childId" in mutation)) throw new Error("Assignment mutation is missing a child identifier.");
      if (educator.role !== "EDUCATOR") throw new Error("Only Educators can receive child assignments.");
      const childId = mutation.childId;
      const child = state.children.find((candidate) => candidate.id === childId && candidate.isActive);
      if (!child) throw new Error("Assignment change references an unknown child.");
      let assignment = state.assignments.find(
        (candidate) => candidate.educatorId === educator.id && candidate.childId === child.id
      );
      if (!assignment) {
        assignment = {
          id: `assignment-${randomUUID()}`,
          educatorId: educator.id,
          childId: child.id,
          active: mutation.active,
          updatedAt: now,
          updatedById: actor.id
        };
        state.assignments.push(assignment);
      } else {
        assignment.active = mutation.active;
        assignment.updatedAt = now;
        assignment.updatedById = actor.id;
      }
      recordSupportEvent(state, {
        type: "ASSIGNMENT_CHANGED",
        actorId: actor.id,
        subjectId: educator.id,
        referenceId: assignment.id,
        occurredAt: now
      });
      return { assignment };
    });
    if ("blocked" in result && result.blocked) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return routeError(error);
  }
}
