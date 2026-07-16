/** Sanitized local-only records used while production contracts remain unresolved. */

import { scryptSync } from "node:crypto";

import type { PilotState, StaffCredential } from "./models";

const NOW = "2026-07-13T14:00:00.000Z";

/** Development-only sign-in password for the three sanitized profiles when the email/password adapter is selected locally. */
export const SANITIZED_FIXTURE_PASSWORD = "sanitized-pilot-password";
const FIXTURE_SALT = Buffer.from("help-review-fixture!", "utf8").subarray(0, 16);
let fixturePasswordHash: string | undefined;

function sanitizedCredentials(): StaffCredential[] {
  if (process.env.NODE_ENV === "production") return [];
  fixturePasswordHash ??= [
    "scrypt",
    "16384.8.1",
    FIXTURE_SALT.toString("base64url"),
    scryptSync(SANITIZED_FIXTURE_PASSWORD, FIXTURE_SALT, 32, { N: 16_384, r: 8, p: 1 }).toString("base64url")
  ].join("$");
  return ["user-educator-1", "user-educator-2", "user-admin-1"].map((userId) => ({
    userId,
    passwordHash: fixturePasswordHash!,
    updatedAt: NOW
  }));
}

export function createSanitizedPilotState(): PilotState {
  return {
    fixtureVersion: 1,
    users: [
      {
        id: "user-educator-1",
        externalSubject: "sandbox:educator.alex",
        email: "alex.educator@example.test",
        displayName: "Alex Morgan",
        role: "EDUCATOR",
        isActive: true
      },
      {
        id: "user-educator-2",
        externalSubject: "sandbox:educator.jordan",
        email: "jordan.educator@example.test",
        displayName: "Jordan Lee",
        role: "EDUCATOR",
        isActive: true
      },
      {
        id: "user-admin-1",
        externalSubject: "sandbox:admin.casey",
        email: "casey.admin@example.test",
        displayName: "Casey Rivera",
        role: "ADMIN",
        isActive: true
      }
    ],
    children: [
      {
        id: "child-1001",
        externalChildId: "Child 1001",
        ageMonths: 19,
        contextLabel: "IFSP: No",
        processingAllowed: true,
        isActive: true
      },
      {
        id: "child-1024",
        externalChildId: "Child 1024",
        ageMonths: 31,
        contextLabel: null,
        processingAllowed: true,
        isActive: true
      },
      {
        id: "child-1048",
        externalChildId: "Child 1048",
        ageMonths: 44,
        contextLabel: "Processing permission pending",
        processingAllowed: false,
        isActive: true
      }
    ],
    assignments: [
      {
        id: "assignment-1",
        educatorId: "user-educator-1",
        childId: "child-1001",
        active: true,
        updatedAt: NOW,
        updatedById: "user-admin-1"
      },
      {
        id: "assignment-2",
        educatorId: "user-educator-1",
        childId: "child-1024",
        active: true,
        updatedAt: NOW,
        updatedById: "user-admin-1"
      },
      {
        id: "assignment-3",
        educatorId: "user-educator-1",
        childId: "child-1048",
        active: true,
        updatedAt: NOW,
        updatedById: "user-admin-1"
      }
    ],
    assessments: [],
    access: [
      {
        id: "access-educator-1",
        exactEmail: "alex.educator@example.test",
        userId: "user-educator-1",
        role: "EDUCATOR",
        active: true,
        updatedAt: NOW,
        updatedById: "user-admin-1"
      },
      {
        id: "access-educator-2",
        exactEmail: "jordan.educator@example.test",
        userId: "user-educator-2",
        role: "EDUCATOR",
        active: true,
        updatedAt: NOW,
        updatedById: "user-admin-1"
      },
      {
        id: "access-admin-1",
        exactEmail: "casey.admin@example.test",
        userId: "user-admin-1",
        role: "ADMIN",
        active: true,
        updatedAt: NOW,
        updatedById: "user-admin-1"
      }
    ],
    credentials: sanitizedCredentials(),
    authTokens: [],
    supportEvents: [],
    videoAccessGrants: []
  };
}
