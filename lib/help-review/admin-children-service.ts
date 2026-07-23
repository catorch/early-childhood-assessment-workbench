import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import type { AssessmentContextSnapshot, PilotChild } from "./models";
import { AccessError, activeUserFromState } from "./server-auth";
import { recordSupportEvent } from "./server-events";
import { readPilotState, updatePilotState } from "./server-store";

export type SupportContextValue = AssessmentContextSnapshot["supportContext"];

export type AdminChildrenMutation =
  | {
      readonly action: "CREATE_CHILD";
      readonly externalChildId: string;
      readonly ageMonths: number;
      readonly supportContext: SupportContextValue;
      readonly contextLabel: string | null;
      readonly processingAllowed: boolean;
    }
  | {
      readonly action: "EDIT_CHILD";
      readonly childId: string;
      readonly externalChildId?: string;
      readonly ageMonths?: number;
      readonly supportContext?: SupportContextValue;
      readonly contextLabel?: string | null;
      readonly processingAllowed?: boolean;
    }
  | { readonly action: "SET_CHILD_ACTIVE"; readonly childId: string; readonly active: boolean };

export interface AdminChildrenServiceDependencies {
  readonly readState: typeof readPilotState;
  readonly updateState: typeof updatePilotState;
}

const defaultDependencies: AdminChildrenServiceDependencies = {
  readState: readPilotState,
  updateState: updatePilotState
};

function duplicateExternalId(children: readonly PilotChild[], externalChildId: string, exceptChildId?: string): boolean {
  return children.some((child) => child.externalChildId === externalChildId && child.id !== exceptChildId);
}

export function createAdminChildrenService(dependencies: AdminChildrenServiceDependencies = defaultDependencies) {
  return {
    async projection(request: NextRequest) {
      const state = await dependencies.readState();
      const actor = activeUserFromState(request, state);
      if (actor.role !== "ADMIN") throw new AccessError("The requested resource is unavailable.");
      return {
        children: state.children,
        assignments: state.assignments,
        educators: state.users.filter((user) => user.role === "EDUCATOR" && user.isActive),
        access: state.access,
        assessmentCounts: Object.fromEntries(state.children.map((child) => [
          child.id,
          state.assessments.filter((assessment) => assessment.childId === child.id).length
        ])),
        actorId: actor.id
      };
    },

    async mutate(request: NextRequest, mutation: AdminChildrenMutation) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        if (actor.role !== "ADMIN") throw new AccessError("The requested resource is unavailable.");
        const now = new Date().toISOString();

        if (mutation.action === "CREATE_CHILD") {
          const externalChildId = mutation.externalChildId.trim();
          if (duplicateExternalId(state.children, externalChildId)) {
            return { blocked: true as const, reason: "A child with this identifier already exists." };
          }
          const child: PilotChild = {
            id: `child-${randomUUID()}`,
            externalChildId,
            ageMonths: mutation.ageMonths,
            contextLabel: mutation.contextLabel,
            supportContext: mutation.supportContext,
            contextSource: "SANITIZED_ADMIN",
            processingAllowed: mutation.processingAllowed,
            isActive: true
          };
          state.children.push(child);
          recordSupportEvent(state, {
            type: "CHILD_CHANGED",
            actorId: actor.id,
            subjectId: child.id,
            occurredAt: now
          });
          return { child };
        }

        const existing = state.children.find((candidate) => candidate.id === mutation.childId);
        if (!existing) throw new AccessError("The requested resource is unavailable.");

        if (mutation.action === "EDIT_CHILD") {
          const externalChildId = mutation.externalChildId?.trim() ?? existing.externalChildId;
          if (duplicateExternalId(state.children, externalChildId, existing.id)) {
            return { blocked: true as const, reason: "A child with this identifier already exists." };
          }
          const child: PilotChild = {
            ...existing,
            externalChildId,
            ageMonths: mutation.ageMonths ?? existing.ageMonths,
            contextLabel: mutation.contextLabel === undefined ? existing.contextLabel : mutation.contextLabel,
            supportContext: mutation.supportContext ?? existing.supportContext,
            contextSource: "SANITIZED_ADMIN",
            processingAllowed: mutation.processingAllowed ?? existing.processingAllowed
          };
          state.children[state.children.findIndex((candidate) => candidate.id === existing.id)] = child;
          recordSupportEvent(state, {
            type: "CHILD_CHANGED",
            actorId: actor.id,
            subjectId: child.id,
            occurredAt: now
          });
          return { child };
        }

        const child: PilotChild = { ...existing, isActive: mutation.active };
        state.children[state.children.findIndex((candidate) => candidate.id === existing.id)] = child;
        if (!mutation.active) {
          for (const assignment of state.assignments) {
            if (assignment.childId === child.id && assignment.active) {
              assignment.active = false;
              assignment.updatedAt = now;
              assignment.updatedById = actor.id;
            }
          }
        }
        recordSupportEvent(state, {
          type: "CHILD_CHANGED",
          actorId: actor.id,
          subjectId: child.id,
          occurredAt: now
        });
        return { child };
      });
    }
  };
}

export const adminChildrenService = createAdminChildrenService();
