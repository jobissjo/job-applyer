# Security review — 31 October 2026

Follow-up: see [the compatibility-preserving fixes and deferred risks](security-fixes-compatibility.md)
for the current status. The findings below describe the state at review time.

Scope: local backend and web source, local configuration, and isolated API probes.
This is not a production penetration test or a guarantee that all vulnerabilities
have been found. No production data was changed, no real SMTP connections were
made by the probes, and no secrets are included in this report. Application code
was not modified during this review.

Six temporary probes reproduced vulnerable behavior. Together with the existing
isolation and HR-safety tests, the verification run completed with **11 passed**.
The temporary probes were removed after review; reproduction steps are below.
The earlier successful functional tests did not cover these security cases.

## Findings

### 1. Critical if deployed: known JWT signing key enables account impersonation

Evidence: [config.py](../backend/app/config.py#L18),
[security.py](../backend/app/utils/security.py#L55), and the sample JWT setting in
[.env.example](../backend/.env.example#L11).

The local runtime configuration matches a known sample/placeholder signing key.
The application also has a fallback signing key in source and does not reject
known placeholders at startup. A person who knows that key can sign a token for
another existing active, verified user without knowing their password.

Reproduced locally: a token signed with the known configured sample key and a
test user's ID was accepted by `GET /api/auth/me` with HTTP 200. Only disposable
test users were involved. Whether production uses the same key is unverified.

Action: generate an independent cryptographically random production secret,
reject missing/sample secrets at startup, and rotate any deployed sample secret.
Rotation invalidates existing tokens. Do not copy the local sample value into
hosting configuration.

### 2. High: any signed-in user can delete shared jobs and other users' records

Evidence: [jobs.py](../backend/app/api/jobs.py#L251),
[job_access.py](../backend/app/services/job_access.py#L8), and
[job.py](../backend/app/models/job.py#L33).

`DELETE /api/jobs/{job_id}` treats visibility as permission to delete. All users
can see non-manual scraped jobs, so any active, verified user can delete those
shared database rows. ORM cascades delete related applications and HR contacts
across users; dependent records may also be lost through database cascades.

Reproduced: created user B's application on a shared job, deleted that job using
user A's token, received HTTP 204, and confirmed user B's application was removed.

Action: implement per-user hiding for shared jobs, reserve global deletion for
an explicit administrator permission, and permit ordinary deletion only for a
user's own manual jobs. Add regression tests that retain other users' records.

### 3. High, subject to network reachability: unrestricted SMTP destinations

Evidence: [email.py](../backend/app/api/email.py#L59),
[email_settings.py](../backend/app/schemas/email_settings.py#L15), and
[email_service.py](../backend/app/services/email_service.py#L13).

A signed-in user can save arbitrary SMTP hosts and ports and trigger a connection
from the backend using `/api/email-settings/test` or an email send. There are no
application checks for loopback, private, link-local, or reserved addresses.
This gives an attacker an internal network connection and service-probing
primitive. Actual reach depends on hosting firewall/egress restrictions.

Reproduced without network traffic: saved `127.0.0.1:6379`, intercepted the SMTP
constructor, and confirmed that the test route invoked its connection method
with that exact destination. This does not demonstrate arbitrary HTTP requests,
cloud metadata theft, or execution of arbitrary commands.

Action: prefer an SMTP-provider allowlist. If arbitrary public mail servers are
required, validate all resolved addresses and ports and enforce outbound network
rules that prevent access to internal services; address DNS rebinding as well.
See [OWASP SSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

### 4. Medium: weak passwords and unlimited application-level login attempts

Evidence: [auth.py](../backend/app/schemas/auth.py#L6) and
[the login route](../backend/app/api/auth.py#L105).

Registration has no password length requirement; its API schema accepts an empty
password. Browser `required` attributes do not protect direct API calls. Login
has no account/IP throttling or progressive delay. Password hashing also runs
synchronously inside an async request handler, increasing resource-exhaustion
risk from repeated attempts. A hosting WAF might provide additional throttling,
but that was not verified.

Reproduced: the registration schema accepted an empty password, and twelve
successive bad logins all reached ordinary credential rejection (HTTP 401),
followed by a successful login. Source review confirmed no application lockout.

Action: enforce sensible password length bounds on the backend, permit strong
passphrases, check breached passwords where practical, and add distributed
per-account/per-IP throttling with progressive delays. Offload costly hashing
from the event loop. The new email-code attempt limit and resend cooldown do
not protect the login endpoint. See [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

### 5. Medium: resume mappings expose other users' private job-title preferences

Evidence: [resumes.py](../backend/app/api/resumes.py#L147),
[resume_service.py](../backend/app/services/resume_service.py#L86), and the
[mapping response](../backend/app/api/resumes.py#L109).

Resume ownership is checked, but linked `job_title_ids` are not checked against
the current user. Both uploading and updating mappings accept foreign IDs.
The response loads those preferences and returns their title and owner ID.
IDs are sequential, so they are guessable.

Reproduced: user A linked their own resume to user B's preference through
`PUT /api/resumes/{id}`. The HTTP 200 response contained B's private preference
text and owner ID. This does not demonstrate reading B's resume contents.

Action: validate that every linked title belongs to the current user before
modifying mappings, on both upload and update; reject the operation atomically.

### 6. Medium: uploaded resumes lack application size and parsing limits

Evidence: [resume_service.py](../backend/app/services/resume_service.py#L41).

Uploads are copied to disk without an application size limit or per-user storage
quota. Unknown extensions are relabeled as PDF rather than rejected. PDF/DOCX
parsing runs synchronously without page, decompression, memory, or time limits.
Repeated uploads can exhaust disk or occupy workers; small compressed documents
can also expand significantly. Proxy request limits, if configured, only
partially address this and have not been inspected.

Confirmed by source review; no large files or resource-exhaustion payloads were
submitted. No remote code execution is claimed.

Action: enforce upload and storage limits, validate supported file formats,
reject invalid documents, and run bounded parsing in an isolated worker with
resource limits. Clean up files if database writes or parsing fail.

### 7. Medium: SMTP passwords and AI API keys are stored in plaintext columns

Evidence: [email_settings.py](../backend/app/models/email_settings.py#L16),
[llm.py](../backend/app/models/llm.py#L16), and the write paths in
[email.py](../backend/app/api/email.py#L66) and
[llm_providers.py](../backend/app/api/llm_providers.py#L73).

These credentials are written directly to ordinary database string columns.
Anyone who obtains a readable database copy or backup can recover the SMTP
credentials and provider API keys. API responses generally mask or omit these
values, which is useful but does not protect stored copies. Hosting-level disk
encryption was not verified and does not protect an exported readable database.

Action: encrypt reusable credentials using a key held outside the database,
restrict database/backup access, and rotate exposed credentials. Password
hashing is not appropriate for these reusable service credentials.

### 8. Medium: seven-day browser tokens cannot be revoked on logout

Evidence: [config.py](../backend/app/config.py#L20),
[Login.tsx](../frontend/src/pages/Login.tsx#L20),
[MainLayout.tsx](../frontend/src/layouts/MainLayout.tsx#L69), and
[security.py](../backend/app/utils/security.py#L48).

Access tokens last seven days and are stored in browser localStorage. Logout
only removes the browser's copy; no session revocation is checked by the API.
A previously copied token can therefore remain valid until expiration, account
deactivation, or signing-key rotation. localStorage is accessible to scripts on
the same origin, increasing the impact of any future XSS issue. This review did
not confirm an XSS exploit; token storage alone is not evidence of one.

Action: use shorter access-token lifetimes and revocable sessions/rotating refresh
tokens. Consider appropriately secured HttpOnly cookies for browser sessions,
with the necessary CSRF protections if cookie authentication is introduced.

## Priority

1. Check the production signing key immediately and rotate it if it is a sample.
2. Block ordinary users from deleting global job rows.
3. Restrict SMTP destination access and outbound network reachability.
4. Fix resume mapping ownership, authentication limits, and upload limits.
5. Protect stored credentials and implement session revocation.

## Limits and positive observations

Many profile, application, resume-download, and private manual-job endpoints do
apply owner checks. The existing isolation and HR-safety tests included in the
review passed. Passwords use bcrypt; JWT decoding pins the configured algorithm;
the new verification codes use keyed hashes, expiry, an atomic five-attempt cap,
and a per-account resend cooldown. These controls do not resolve the findings above.

Production TLS/HSTS, CSP/framing headers, reverse-proxy limits, firewall/egress
rules, deployed secrets, dependency advisories, cloud/IAM permissions, and backup
access were not audited. No conclusion about their safety follows from this
source review. No live attack or destructive request was sent to the website.
