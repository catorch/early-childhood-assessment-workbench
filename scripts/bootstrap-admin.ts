import "dotenv/config";

import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

import { issueAuthToken } from "../lib/help-review/email-password-auth";
import { setPasswordUrl } from "../lib/help-review/email-sender";
import { recordSupportEvent } from "../lib/help-review/server-events";
import { updatePilotState } from "../lib/help-review/server-store";

/**
 * Creates or reactivates the first Admin for an email/password environment and
 * prints a single-use account-setup link. Run this once against a fresh database;
 * every later staff change goes through the authenticated /admin/access surface.
 */
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const { values } = parseArgs({
    args,
    options: {
      email: { type: "string", short: "e" },
      name: { type: "string", short: "n" },
      help: { type: "boolean", short: "h", default: false }
    },
    strict: true
  });

  if (values.help || !values.email || !values.name) {
    console.log("Usage: pnpm admin:bootstrap -- --email <exact-admin-email> --name <display-name>");
    console.log("Prints a single-use set-password link for the first Admin account.");
    return;
  }

  const exactEmail = values.email.trim().toLowerCase();
  const displayName = values.name.trim();
  if (!/^[^\s@]+@[^\s@]+$/.test(exactEmail) || displayName.length < 2) {
    throw new Error("Provide a valid --email and a --name with at least two characters.");
  }

  const issued = await updatePilotState((state) => {
    let admin = state.users.find((user) => user.email.toLowerCase() === exactEmail);
    if (admin && admin.role !== "ADMIN") {
      throw new Error("That email is already provisioned with a non-Admin role.");
    }
    if (!admin) {
      admin = {
        id: `user-${randomUUID()}`,
        externalSubject: `staff:${randomUUID()}`,
        email: exactEmail,
        displayName,
        role: "ADMIN",
        isActive: true
      };
      state.users.push(admin);
    }
    const now = new Date().toISOString();
    let provision = state.access.find((candidate) => candidate.userId === admin.id);
    if (!provision) {
      provision = {
        id: `access-${randomUUID()}`,
        exactEmail,
        userId: admin.id,
        role: "ADMIN",
        active: true,
        updatedAt: now,
        updatedById: admin.id
      };
      state.access.push(provision);
    } else {
      Object.assign(provision, { active: true, updatedAt: now, updatedById: admin.id });
    }
    const token = issueAuthToken(state, { userId: admin.id, purpose: "INVITE", createdById: admin.id });
    recordSupportEvent(state, {
      type: "ACCESS_CHANGED",
      actorId: admin.id,
      subjectId: admin.id,
      referenceId: provision.id
    });
    return { adminId: admin.id, rawToken: token.rawToken, expiresAt: token.record.expiresAt };
  });

  console.log(`Admin ready: ${exactEmail} (${issued.adminId})`);
  console.log(`Single-use setup link (expires ${issued.expiresAt}):`);
  console.log(setPasswordUrl(issued.rawToken));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
