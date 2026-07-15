import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import type { Role } from "./models";
import { AccessError, activeUserFromState } from "./server-auth";
import { recordSupportEvent } from "./server-events";
import { readPilotState, updatePilotState } from "./server-store";

export type AdminAccessMutation =
  | { readonly action: "PROVISION_STAFF"; readonly email: string; readonly displayName: string; readonly role: Role }
  | { readonly action: "SET_ACCESS"; readonly userId: string; readonly active: boolean }
  | { readonly action: "SET_ASSIGNMENT"; readonly userId: string; readonly childId: string; readonly active: boolean };

export interface AdminAccessServiceDependencies {
  readonly readState: typeof readPilotState;
  readonly updateState: typeof updatePilotState;
}

const defaultDependencies: AdminAccessServiceDependencies = {
  readState: readPilotState,
  updateState: updatePilotState
};

export function createAdminAccessService(dependencies: AdminAccessServiceDependencies = defaultDependencies) {
  return {
    async projection(request: NextRequest) {
      const state = await dependencies.readState();
      const actor = activeUserFromState(request, state);
      if (actor.role !== "ADMIN") throw new AccessError("The requested resource is unavailable.");
      return {
        staff: state.users,
        children: state.children.filter((child) => child.isActive),
        access: state.access,
        assignments: state.assignments,
        actorId: actor.id
      };
    },

    async mutate(request: NextRequest, mutation: AdminAccessMutation) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        if (actor.role !== "ADMIN") throw new AccessError("The requested resource is unavailable.");
        const now = new Date().toISOString();
        if (mutation.action === "PROVISION_STAFF") {
          const exactEmail = mutation.email.trim().toLowerCase();
          let staffMember = state.users.find((user) => user.email.toLowerCase() === exactEmail);
          if (staffMember && staffMember.role !== mutation.role) {
            return { blocked: true as const, reason: "That identity is already provisioned with a different role." };
          }
          if (!staffMember) {
            staffMember = {
              id: `user-${randomUUID()}`,
              externalSubject: `sandbox:${randomUUID()}`,
              email: exactEmail,
              displayName: mutation.displayName.trim(),
              role: mutation.role,
              isActive: true
            };
            state.users.push(staffMember);
          }
          let provision = state.access.find((candidate) => candidate.userId === staffMember.id);
          if (!provision) {
            provision = {
              id: `access-${randomUUID()}`,
              exactEmail,
              userId: staffMember.id,
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
            subjectId: staffMember.id,
            referenceId: provision.id,
            occurredAt: now
          });
          return { educator: staffMember, access: provision };
        }

        const staffMember = state.users.find((user) => user.id === mutation.userId);
        if (!staffMember) throw new AccessError("The requested resource is unavailable.");
        if (mutation.action === "SET_ACCESS") {
          if (staffMember.id === actor.id && !mutation.active) {
            throw new AccessError("An Admin cannot deactivate their own active session.", 403);
          }
          let provision = state.access.find((candidate) => candidate.userId === staffMember.id);
          if (!provision) {
            provision = {
              id: `access-${randomUUID()}`,
              exactEmail: staffMember.email,
              userId: staffMember.id,
              role: staffMember.role,
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
            subjectId: staffMember.id,
            referenceId: provision.id,
            occurredAt: now
          });
          return { access: provision };
        }

        if (staffMember.role !== "EDUCATOR") {
          return { blocked: true as const, reason: "Only Educators can receive child assignments." };
        }
        const child = state.children.find((candidate) => candidate.id === mutation.childId && candidate.isActive);
        if (!child) throw new AccessError("The requested resource is unavailable.");
        let assignment = state.assignments.find(
          (candidate) => candidate.educatorId === staffMember.id && candidate.childId === child.id
        );
        if (!assignment) {
          assignment = {
            id: `assignment-${randomUUID()}`,
            educatorId: staffMember.id,
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
          subjectId: staffMember.id,
          referenceId: assignment.id,
          occurredAt: now
        });
        return { assignment };
      });
    }
  };
}

export const adminAccessService = createAdminAccessService();
