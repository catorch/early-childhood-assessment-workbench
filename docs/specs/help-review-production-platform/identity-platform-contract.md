# Managed Identity Platform Contract

Updated: July 15, 2026

Selected fallback: Google Cloud Identity Platform email/password. HELP Connect is not implemented in parallel. Sandbox profiles remain limited to local and visibly sanitized development.

## Security Boundary

- Public signup and end-user account deletion are disabled in Identity Platform.
- An Admin first provisions an exact email and role in HELP Review. In managed mode, the same command idempotently creates the provider account without a password.
- The browser sends email/password directly to `identitytoolkit.googleapis.com`; HELP Review never receives, stores, logs, or proxies the password or refresh token.
- The browser sends only the returned short-lived ID token to `POST /api/session` over HTTPS.
- Firebase Admin verifies signature, audience, issuer, expiry, provider, verified email, disabled state, and revocation through Cloud Run application-default credentials.
- First successful verification links the stable provider UID only to the exact active email provisioned by an Admin. Provider claims never assign an application role or child access.
- HELP Review issues a provider-bound, HTTP-only, secure, same-site application session for at most one hour. Sandbox and managed application cookies have distinct issuers and cannot be replayed across modes.
- Every application request rechecks the local user, access provision, role, and child assignment. Admin deactivation therefore rejects an existing application session on its next request.

## Setup And Recovery

1. An authorized Admin provisions exact email, display name, and immutable application role.
2. Identity Platform creates the account with no password and no assumed email verification.
3. The staff member enters the provisioned email on `/sign-in` and chooses **Reset password**. Google sends the non-enumerating provider email.
4. After setting a password, the staff member signs in. If email verification is still required, the application asks Google to send the verification email and does not create an application session.
5. The staff member verifies the email and signs in again. Only then can exact-email linking occur.

Sign-in and reset responses are non-enumerating. A failed sign-in clears the password, preserves only the entered email, focuses the safe error, and exposes no provider code.

## Lifecycle

- Deactivation disables the provider account and the local access provision; the local change remains the immediate authorization authority.
- Reactivation enables the provider account before local access is restored.
- Sign-out deletes the HELP Review cookie. No provider refresh token is retained by the application.
- Changing a provider email does not silently migrate access; the new email must match the explicit provision.
- Role changes are rejected as conflicting provisioning rather than inferred from provider data.

## Deployment

Terraform enables email/password only, disables anonymous/phone/signup/delete paths, creates a browser API key restricted to Identity Toolkit and approved HTTPS referrers, and creates a project custom role containing only `firebaseauth.users.get`, `firebaseauth.users.create`, and `firebaseauth.users.update`. Those permissions cover revocation/user checks and the application-authorized Admin lifecycle without granting provider configuration, secret-reading, or user-deletion access. Required variables are:

```text
identity_adapter            = "identity-platform"
identity_authorized_domains = ["review.example.org"]
identity_allowed_referrers  = ["https://review.example.org/*"]
```

`HELP_REVIEW_IDENTITY_PLATFORM_PROJECT_ID` and the restricted browser key are injected into the web service. Cloud Run uses ADC; no service-account key file is created.

## Acceptance

Automated contracts cover exact-email linking, unknown/inactive/role-drift rejection, provider account idempotency, provider disable, one-hour issuer-bound sessions, runtime fail-closed configuration, safe desktop/mobile sign-in, password clearing, error focus, reset non-enumeration, and the browser-to-Google-to-application token exchange.

On July 15, QA2 exercised the live provider with two exact provisioned accounts. Google accepted reset and verification-message requests; verification and reset action codes completed; verified Admin and Educator sign-in, logout, deactivation, disabled-account rejection, reactivation, session revocation, and shared application abuse limits passed. The deployed exercise found and fixed the missing provider lifecycle IAM role and the misleading configuration-loading copy. Organization project/domain transfer remains an infrastructure handoff concern rather than an unimplemented identity behavior.
