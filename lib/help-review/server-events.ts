import { randomUUID } from "node:crypto";

import type { PilotState, SupportEvent } from "./models";

export function recordSupportEvent(
  state: PilotState,
  event: Omit<SupportEvent, "id" | "occurredAt"> & { readonly occurredAt?: string }
): SupportEvent {
  const recorded: SupportEvent = {
    ...event,
    id: `event-${randomUUID()}`,
    occurredAt: event.occurredAt ?? new Date().toISOString()
  };
  (state.supportEvents ??= []).push(recorded);
  return recorded;
}
