import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { credentialSummary, issueAuthToken } from "./email-password-auth";
import type { Role } from "./models";
import { AccessError, activeUserFromState, selectedIdentityAdapter } from "./server-auth";
import { recordSupportEvent } from "./server-events";
import { readPilotState, updatePilotState } from "./server-store";

export type AdminAccessMutation =
  | { readonly action: "PROVISION_STAFF"; readonly email: string; readonly displayName: string; readonly role: Role }
  | { readonly action: "RESEND_INVITE"; readonly userId: string }
  | { readonly action: "EDIT_STAFF"; readonly userId: string; readonly displayName?: string; readonly role?: Role }
  | { readonly action: "REMOVE_STAFF"; readonly userId: string }
  | { readonly action: "SET_ACCESS"; readonly userId: string; readonly active: boolean }
  | { readonly action: "SET_ASSIGNMENT"; readonly userId: string; readonly childId: string; readonly active: boolean };

/** Raw invitation secret handed to the route for one-time email delivery; never persisted or projected. */
export interface IssuedInvite {
  readonly email: string;
  readonly rawToken: string;
  readonly expiresAt: string;
}

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
      const emailPasswordMode = selectedIdentityAdapter().name === "email-password";
      return {
        staff: state.users.filter((user) => user.isActive || state.access.some((provision) => provision.userId === user.id && provision.active)),
        children: state.children.filter((child) => child.isActive),
        access: state.access,
        assignments: state.assignments,
        credentialStates: emailPasswordMode
          ? Object.fromEntries(state.users.map((user) => [user.id, credentialSummary(state, user.id)]))
          : undefined,
        identityMode: emailPasswordMode ? ("email-password" as const) : ("sandbox" as const),
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
              externalSubject: `staff:${randomUUID()}`,
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
          let invite: IssuedInvite | undefined;
          if (selectedIdentityAdapter().name === "email-password") {
            const issued = issueAuthToken(state, { userId: staffMember.id, purpose: "INVITE", createdById: actor.id });
            invite = { email: exactEmail, rawToken: issued.rawToken, expiresAt: issued.record.expiresAt };
          }
          return { educator: staffMember, access: provision, invite };
        }

        const staffMember = state.users.find((user) => user.id === mutation.userId);
        if (!staffMember) throw new AccessError("The requested resource is unavailable.");

        if (mutation.action === "RESEND_INVITE") {
          if (selectedIdentityAdapter().name !== "email-password") {
            return { blocked: true as const, reason: "Invitations apply to the email/password sign-in mode." };
          }
          const provision = state.access.find((candidate) => candidate.userId === staffMember.id && candidate.active);
          if (!staffMember.isActive || !provision) {
            return { blocked: true as const, reason: "Reactivate this staff member before sending an invitation." };
          }
          const issued = issueAuthToken(state, { userId: staffMember.id, purpose: "INVITE", createdById: actor.id });
          recordSupportEvent(state, {
            type: "CREDENTIAL_CHANGED",
            actorId: actor.id,
            subjectId: staffMember.id,
            referenceId: issued.record.id,
            occurredAt: now
          });
          const invite: IssuedInvite = { email: staffMember.email, rawToken: issued.rawToken, expiresAt: issued.record.expiresAt };
          return { invite };
        }

        if (mutation.action === "EDIT_STAFF") {
          const nextRole = mutation.role ?? staffMember.role;
          if (nextRole !== staffMember.role) {
            if (staffMember.id === actor.id) {
              throw new AccessError("An Admin cannot change their own role.", 403);
            }
            if (staffMember.role === "EDUCATOR" && state.assignments.some(
              (assignment) => assignment.educatorId === staffMember.id && assignment.active
            )) {
              return { blocked: true as const, reason: "Remove this Educator's child assignments before changing the role." };
            }
          }
          const nextDisplayName = mutation.displayName?.trim() || staffMember.displayName;
          const updatedStaff = { ...staffMember, displayName: nextDisplayName, role: nextRole };
          state.users = state.users.map((user) => (user.id === updatedStaff.id ? updatedStaff : user));
          const provision = state.access.find((candidate) => candidate.userId === updatedStaff.id);
          if (provision) {
            Object.assign(provision, { role: nextRole, updatedAt: now, updatedById: actor.id });
          }
          recordSupportEvent(state, {
            type: "ACCESS_CHANGED",
            actorId: actor.id,
            subjectId: updatedStaff.id,
            referenceId: provision?.id,
            occurredAt: now
          });
          return { educator: updatedStaff, access: provision };
        }

        if (mutation.action === "REMOVE_STAFF") {
          if (staffMember.id === actor.id) {
            throw new AccessError("An Admin cannot remove their own access.", 403);
          }
          const tombstone = randomUUID();
          const removedStaff = {
            ...staffMember,
            email: `removed-${tombstone}@removed.invalid`,
            externalSubject: `removed:${tombstone}`,
            isActive: false
          };
          state.users = state.users.map((user) => (user.id === removedStaff.id ? removedStaff : user));
          for (const provision of state.access) {
            if (provision.userId === removedStaff.id) {
              Object.assign(provision, {
                active: false,
                exactEmail: removedStaff.email,
                updatedAt: now,
                updatedById: actor.id
              });
            }
          }
          for (const assignment of state.assignments) {
            if (assignment.educatorId === removedStaff.id && assignment.active) {
              Object.assign(assignment, { active: false, updatedAt: now, updatedById: actor.id });
            }
          }
          state.credentials = (state.credentials ?? []).filter((credential) => credential.userId !== removedStaff.id);
          state.authTokens = (state.authTokens ?? []).filter((token) => token.userId !== removedStaff.id);
          recordSupportEvent(state, {
            type: "ACCESS_CHANGED",
            actorId: actor.id,
            subjectId: removedStaff.id,
            occurredAt: now
          });
          return { removed: true as const };
        }
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
