import { createHash, randomUUID } from "node:crypto";

import { parse } from "csv-parse/sync";
import { z } from "zod";

import type { PilotChild, PilotState, PilotUser } from "./models";
import { recordSupportEvent } from "./server-events";
import { readPilotState, updatePilotState } from "./server-store";

export const ROSTER_IMPORT_VERSION = "help-roster-v1";
export const ROSTER_IMPORT_MAX_BYTES = 1024 * 1024;
export const ROSTER_IMPORT_MAX_ROWS = 5_000;
export const ROSTER_IMPORT_HEADERS = [
  "child_external_id",
  "age_months",
  "support_context",
  "context_label",
  "processing_allowed",
  "child_active",
  "educator_email",
  "assignment_active"
] as const;

const SupportContextSchema = z.string().trim().transform((value) => value.toUpperCase()).pipe(
  z.enum(["NONE_REPORTED", "IFSP", "DISABILITY", "IFSP_AND_DISABILITY", "UNKNOWN"])
);
const RequiredBooleanSchema = z.string().trim().transform((value) => value.toLowerCase()).pipe(
  z.enum(["true", "false"])
).transform((value) => value === "true");
const OptionalBooleanSchema = z.string().trim().transform((value) => value.toLowerCase()).pipe(
  z.enum(["", "true", "false"])
).transform((value) => value === "" ? null : value === "true");
const SafeTextSchema = z.string().trim().min(1).max(100).refine(
  (value) => !/[\u0000-\u001f\u007f]/.test(value),
  "Control characters are not allowed."
);
const ContextLabelSchema = z.string().trim().max(160).refine(
  (value) => !/[\u0000-\u001f\u007f]/.test(value),
  "Control characters are not allowed."
).transform((value) => value || null);
const EmailSchema = z.string().trim().transform((value) => value.toLowerCase()).pipe(
  z.union([z.literal(""), z.email().max(254)])
).transform((value) => value || null);

const RosterRowSchema = z.object({
  child_external_id: SafeTextSchema,
  age_months: z.string().trim().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(72)),
  support_context: SupportContextSchema,
  context_label: ContextLabelSchema,
  processing_allowed: RequiredBooleanSchema,
  child_active: RequiredBooleanSchema,
  educator_email: EmailSchema,
  assignment_active: OptionalBooleanSchema
}).strict().superRefine((row, context) => {
  if (row.educator_email && row.assignment_active === null) {
    context.addIssue({
      code: "custom",
      path: ["assignment_active"],
      message: "Assignment status is required when an educator email is present."
    });
  }
  if (!row.educator_email && row.assignment_active !== null) {
    context.addIssue({
      code: "custom",
      path: ["educator_email"],
      message: "Educator email is required when assignment status is present."
    });
  }
  if (!row.child_active && row.assignment_active === true) {
    context.addIssue({
      code: "custom",
      path: ["assignment_active"],
      message: "An inactive child cannot have an active assignment."
    });
  }
}).transform((row) => ({
  childExternalId: row.child_external_id,
  ageMonths: row.age_months,
  supportContext: row.support_context,
  contextLabel: row.context_label,
  processingAllowed: row.processing_allowed,
  childActive: row.child_active,
  educatorEmail: row.educator_email,
  assignmentActive: row.assignment_active
}));

type RosterRow = z.output<typeof RosterRowSchema> & { readonly rowNumber: number };

export interface RosterImportIssue {
  readonly code: string;
  readonly message: string;
  readonly row?: number;
  readonly field?: string;
}

export class RosterImportValidationError extends Error {
  constructor(readonly issues: readonly RosterImportIssue[]) {
    super("The roster import did not pass validation.");
    this.name = "RosterImportValidationError";
  }
}

export interface RosterImportSummary {
  readonly importId: string;
  readonly version: typeof ROSTER_IMPORT_VERSION;
  readonly dryRun: boolean;
  readonly replayed: boolean;
  readonly rows: number;
  readonly childrenCreated: number;
  readonly childrenUpdated: number;
  readonly childrenActivated: number;
  readonly childrenDeactivated: number;
  readonly assignmentsCreated: number;
  readonly assignmentsActivated: number;
  readonly assignmentsDeactivated: number;
}

interface ParsedRoster {
  readonly importId: string;
  readonly rows: readonly RosterRow[];
}

interface RosterImportDependencies {
  readonly readState: typeof readPilotState;
  readonly updateState: typeof updatePilotState;
  readonly now: () => string;
  readonly id: () => string;
}

const defaultDependencies: RosterImportDependencies = {
  readState: readPilotState,
  updateState: updatePilotState,
  now: () => new Date().toISOString(),
  id: randomUUID
};

function issue(code: string, message: string, row?: number, field?: string): RosterImportIssue {
  return { code, message, ...(row ? { row } : {}), ...(field ? { field } : {}) };
}

function validateHeaders(headers: string[]): string[] {
  const normalized = headers.map((header) => header.trim());
  const issues: RosterImportIssue[] = [];
  const duplicates = normalized.filter((header, index) => normalized.indexOf(header) !== index);
  if (duplicates.length > 0) issues.push(issue("DUPLICATE_HEADER", "The CSV contains a duplicate column name."));
  const expected = new Set<string>(ROSTER_IMPORT_HEADERS);
  if (normalized.some((header) => !expected.has(header))) {
    issues.push(issue("UNKNOWN_HEADER", "The CSV contains an unsupported column."));
  }
  if (ROSTER_IMPORT_HEADERS.some((header) => !normalized.includes(header))) {
    issues.push(issue("MISSING_HEADER", "The CSV is missing a required column."));
  }
  if (issues.length > 0) throw new RosterImportValidationError(issues);
  return normalized;
}

function parseRoster(input: string | Buffer): ParsedRoster {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  if (bytes.byteLength === 0) {
    throw new RosterImportValidationError([issue("EMPTY_FILE", "Choose a non-empty roster CSV.")]);
  }
  if (bytes.byteLength > ROSTER_IMPORT_MAX_BYTES) {
    throw new RosterImportValidationError([issue("FILE_TOO_LARGE", "The roster CSV must be no more than 1 MB.")]);
  }
  if (bytes.includes(0)) {
    throw new RosterImportValidationError([issue("INVALID_ENCODING", "The roster CSV must be UTF-8 text.")]);
  }

  let records: Record<string, string>[];
  try {
    records = parse(bytes, {
      bom: true,
      columns: validateHeaders,
      max_record_size: 16 * 1024,
      relax_column_count: false,
      skip_empty_lines: true,
      trim: true
    }) as Record<string, string>[];
  } catch (error) {
    if (error instanceof RosterImportValidationError) throw error;
    const line = typeof (error as { lines?: unknown }).lines === "number"
      ? (error as { lines: number }).lines
      : undefined;
    throw new RosterImportValidationError([
      issue("CSV_PARSE_ERROR", "The CSV structure could not be parsed.", line)
    ]);
  }

  if (records.length === 0) {
    throw new RosterImportValidationError([issue("NO_ROWS", "The roster CSV must contain at least one data row.")]);
  }
  if (records.length > ROSTER_IMPORT_MAX_ROWS) {
    throw new RosterImportValidationError([
      issue("TOO_MANY_ROWS", `The roster CSV must contain no more than ${ROSTER_IMPORT_MAX_ROWS} rows.`)
    ]);
  }

  const rows: RosterRow[] = [];
  const issues: RosterImportIssue[] = [];
  records.forEach((record, index) => {
    const parsed = RosterRowSchema.safeParse(record);
    if (parsed.success) rows.push({ ...parsed.data, rowNumber: index + 2 });
    else {
      for (const validationIssue of parsed.error.issues) {
        issues.push(issue(
          "INVALID_VALUE",
          validationIssue.message,
          index + 2,
          validationIssue.path[0]?.toString()
        ));
      }
    }
  });

  const childDefinition = new Map<string, string>();
  const assignmentPairs = new Set<string>();
  for (const row of rows) {
    const definition = JSON.stringify([
      row.ageMonths,
      row.supportContext,
      row.contextLabel,
      row.processingAllowed,
      row.childActive
    ]);
    const priorDefinition = childDefinition.get(row.childExternalId);
    if (priorDefinition && priorDefinition !== definition) {
      issues.push(issue(
        "CONFLICTING_CHILD",
        "Repeated child rows must use identical child and context fields.",
        row.rowNumber,
        "child_external_id"
      ));
    } else childDefinition.set(row.childExternalId, definition);

    if (row.educatorEmail) {
      const pair = `${row.childExternalId}\u0000${row.educatorEmail}`;
      if (assignmentPairs.has(pair)) {
        issues.push(issue(
          "DUPLICATE_ASSIGNMENT",
          "Each educator-child assignment may appear only once.",
          row.rowNumber,
          "educator_email"
        ));
      }
      assignmentPairs.add(pair);
    }
  }
  if (issues.length > 0) throw new RosterImportValidationError(issues.slice(0, 100));

  return {
    importId: `roster-${createHash("sha256").update(bytes).digest("hex")}`,
    rows
  };
}

function activeProvisionFor(state: PilotState, user: PilotUser): boolean {
  return state.access.some((provision) => provision.userId === user.id && provision.active);
}

function preflight(state: PilotState, rows: readonly RosterRow[], actorId: string): PilotUser {
  const actor = state.users.find((user) => user.id === actorId && user.role === "ADMIN" && user.isActive);
  if (!actor || !activeProvisionFor(state, actor)) {
    throw new RosterImportValidationError([
      issue("INVALID_ACTOR", "Roster import requires an active provisioned Admin actor.")
    ]);
  }

  const issues: RosterImportIssue[] = [];
  for (const row of rows) {
    if (!row.educatorEmail) continue;
    const educator = state.users.find((user) => user.email.toLowerCase() === row.educatorEmail);
    if (!educator || educator.role !== "EDUCATOR") {
      issues.push(issue(
        "UNKNOWN_EDUCATOR",
        "The educator email is not provisioned as an Educator.",
        row.rowNumber,
        "educator_email"
      ));
      continue;
    }
    if (row.assignmentActive && (!educator.isActive || !activeProvisionFor(state, educator))) {
      issues.push(issue(
        "INACTIVE_EDUCATOR",
        "An active assignment requires active Educator access.",
        row.rowNumber,
        "assignment_active"
      ));
    }
  }
  if (issues.length > 0) throw new RosterImportValidationError(issues.slice(0, 100));
  return actor;
}

function childChanged(child: PilotChild, row: RosterRow): boolean {
  return child.ageMonths !== row.ageMonths ||
    child.contextLabel !== row.contextLabel ||
    child.supportContext !== row.supportContext ||
    child.contextSource !== "ROSTER_ADAPTER" ||
    child.processingAllowed !== row.processingAllowed ||
    child.isActive !== row.childActive;
}

function reconcile(
  state: PilotState,
  roster: ParsedRoster,
  actorId: string,
  dryRun: boolean,
  dependencies: Pick<RosterImportDependencies, "now" | "id">
): RosterImportSummary {
  const actor = preflight(state, roster.rows, actorId);
  const now = dependencies.now();
  const replayed = (state.supportEvents ?? []).some(
    (event) => event.type === "ROSTER_IMPORTED" && event.referenceId === roster.importId
  );
  const summary = {
    importId: roster.importId,
    version: ROSTER_IMPORT_VERSION,
    dryRun,
    replayed,
    rows: roster.rows.length,
    childrenCreated: 0,
    childrenUpdated: 0,
    childrenActivated: 0,
    childrenDeactivated: 0,
    assignmentsCreated: 0,
    assignmentsActivated: 0,
    assignmentsDeactivated: 0
  } satisfies RosterImportSummary;

  const uniqueChildRows = new Map<string, RosterRow>();
  for (const row of roster.rows) uniqueChildRows.set(row.childExternalId, row);
  const childByExternalId = new Map(state.children.map((child) => [child.externalChildId, child]));

  for (const row of uniqueChildRows.values()) {
    const existing = childByExternalId.get(row.childExternalId);
    if (!existing) {
      const child: PilotChild = {
        id: `child-${dependencies.id()}`,
        externalChildId: row.childExternalId,
        ageMonths: row.ageMonths,
        contextLabel: row.contextLabel,
        supportContext: row.supportContext,
        contextSource: "ROSTER_ADAPTER",
        processingAllowed: row.processingAllowed,
        isActive: row.childActive
      };
      state.children.push(child);
      childByExternalId.set(row.childExternalId, child);
      summary.childrenCreated += 1;
      continue;
    }
    if (!childChanged(existing, row)) continue;
    if (!existing.isActive && row.childActive) summary.childrenActivated += 1;
    if (existing.isActive && !row.childActive) summary.childrenDeactivated += 1;
    const updated: PilotChild = {
      ...existing,
      ageMonths: row.ageMonths,
      contextLabel: row.contextLabel,
      supportContext: row.supportContext,
      contextSource: "ROSTER_ADAPTER",
      processingAllowed: row.processingAllowed,
      isActive: row.childActive
    };
    state.children[state.children.findIndex((child) => child.id === existing.id)] = updated;
    childByExternalId.set(row.childExternalId, updated);
    summary.childrenUpdated += 1;
  }

  for (const row of roster.rows) {
    if (!row.educatorEmail || row.assignmentActive === null) continue;
    const educator = state.users.find((user) => user.email.toLowerCase() === row.educatorEmail)!;
    const child = childByExternalId.get(row.childExternalId)!;
    let assignment = state.assignments.find(
      (candidate) => candidate.educatorId === educator.id && candidate.childId === child.id
    );
    if (!assignment && row.assignmentActive) {
      assignment = {
        id: `assignment-${dependencies.id()}`,
        educatorId: educator.id,
        childId: child.id,
        active: true,
        updatedAt: now,
        updatedById: actor.id
      };
      state.assignments.push(assignment);
      summary.assignmentsCreated += 1;
    } else if (assignment && assignment.active !== row.assignmentActive) {
      assignment.active = row.assignmentActive;
      assignment.updatedAt = now;
      assignment.updatedById = actor.id;
      if (row.assignmentActive) summary.assignmentsActivated += 1;
      else summary.assignmentsDeactivated += 1;
    }
  }

  for (const row of uniqueChildRows.values()) {
    if (row.childActive) continue;
    const child = childByExternalId.get(row.childExternalId)!;
    for (const assignment of state.assignments.filter((candidate) => candidate.childId === child.id && candidate.active)) {
      assignment.active = false;
      assignment.updatedAt = now;
      assignment.updatedById = actor.id;
      summary.assignmentsDeactivated += 1;
    }
  }

  if (!dryRun && !replayed) {
    recordSupportEvent(state, {
      type: "ROSTER_IMPORTED",
      actorId: actor.id,
      referenceId: roster.importId,
      occurredAt: now
    });
  }
  return summary;
}

export function createRosterImportService(dependencies: RosterImportDependencies = defaultDependencies) {
  return {
    async run(input: string | Buffer, options: { readonly actorId: string; readonly dryRun: boolean }) {
      const roster = parseRoster(input);
      if (options.dryRun) {
        const state = structuredClone(await dependencies.readState());
        return reconcile(state, roster, options.actorId, true, dependencies);
      }
      return dependencies.updateState((state) => reconcile(state, roster, options.actorId, false, dependencies));
    }
  };
}

export const rosterImportService = createRosterImportService();
