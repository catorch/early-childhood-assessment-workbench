import { randomUUID } from "node:crypto";

import type { PilotState, SupportEvent } from "./models";

export function recordSupportEvent(
  state: PilotState,
  event: Omit<SupportEvent, "id" | "occurredAt"> & { readonly occurredAt?: string }
): SupportEvent {
  const recorded: SupportEvent = {
    id: `event-${randomUUID()}`,
    type: event.type,
    actorId: event.actorId,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    ...(event.assessmentId ? { assessmentId: event.assessmentId } : {}),
    ...(event.subjectId ? { subjectId: event.subjectId } : {}),
    ...(event.referenceId ? { referenceId: event.referenceId } : {})
  };
  (state.supportEvents ??= []).push(recorded);
  return recorded;
}
