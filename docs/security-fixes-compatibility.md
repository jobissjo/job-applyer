# Security fixes with existing-user compatibility

Prepared on 31 October 2026 in response to the requirement to avoid disrupting
an application already in use. These are local source changes, not a production
deployment. The [original security review](security-review-2026-10-31.md) records
the findings before these fixes.

## Status of all eight findings

| Finding | Status | Compatibility and remaining risk |
| --- | --- | --- |
| Known JWT signing key | Deferred | Rotating the key or rejecting it at startup would invalidate existing tokens or stop a running deployment. The configured key was not changed. The critical impersonation risk remains if production uses a known key. |
| Shared-job deletion affects other users | Fixed | The existing DELETE endpoint and HTTP 204 response remain. Removing a shared listing now hides it only for that user, including discovery, dashboard job totals, the missing-HR queue, and future auto-apply discovery. Existing applications are retained and remain usable. Other users' data remains intact. Owner-only manual-job deletion keeps its existing behavior. |
| Arbitrary SMTP network destinations | Deferred | Blocking private destinations or restricting ports may break a legitimate current SMTP service. Existing settings and sending were left unchanged. The network-access risk remains. A production SMTP/egress inventory is needed before enforcing restrictions. |
| Passwords and login attempts | Partially fixed | New accounts require at least eight characters and at most 72 UTF-8 bytes, matching bcrypt's input bound. Existing passwords still work without a reset. Repeated attempts for one client-address/email pair are limited to 15 per five-minute fixed window, shared across API workers through the database. Success clears that pair's counter. Hashing and verification now run outside the event loop. Distributed guessing and guesses across many different emails still need broader edge controls; account-wide or shared-IP lockouts were avoided. |
| Foreign resume mappings | Fixed | Both uploads and updates validate ownership of every mapped title before writing. Invalid IDs return 404 without revealing the owner. Duplicate valid IDs are accepted and deduplicated. Existing malformed links are omitted from responses without deleting stored resumes or changing valid mappings. |
| Unbounded uploads/parsing | Partially mitigated | File copying and parsing now run outside the async event loop. Existing formats, file sizes and stored files are accepted as before. Storage quotas, upload caps, strict format rejection, and resource-isolated parsing were deferred because they can reject currently accepted resumes or require deployment changes. Disk/memory and parser-worker exhaustion risks remain. |
| Plaintext service credentials | Deferred | Encrypting existing SMTP/API credentials needs an externally managed key, a tested data migration, and coordinated API/worker rollout. No stored credentials were rewritten or rotated. Database/backup disclosure risk remains. |
| Long-lived tokens and logout | Partially fixed | Website logout now calls an additive API endpoint that revokes only the current token, including legacy tokens without a jti claim. Other sessions remain valid. New tokens receive unique session IDs so separately issued sessions can be revoked independently. Seven-day lifetime, browser storage and existing tokens remain unchanged. If the server cannot be reached, local logout still works and displays a warning that revocation failed. Older web/mobile clients that do not call the endpoint retain their prior local-only logout behavior. |

Malformed signed JWT user IDs now return HTTP 401 instead of raising a database
or conversion error. Valid existing numeric subject IDs remain supported.

## Deployment

No production requests, deployment, credential changes, or database migration
were performed during this hardening task. Back up the production database using
the deployment's normal procedure, then apply migrations to that database:

```powershell
# From backend, with the production DATABASE_URL configured in its environment:
..\venv\Scripts\python.exe -m alembic upgrade head
```

The new revision is `e80fb7c69438`, after `d79ea6b58327`. It adds `hidden_jobs`,
`revoked_tokens`, and `login_attempts`; it does not rewrite existing account,
password, resume, SMTP, application, or token data. The preceding email-verification
migration, if not already applied, preserves access for accounts that predate it.
Deploy/restart the backend before deploying the updated web build. No mobile app
upgrade is required for existing clients to continue using the API.

All API processes must use the upgraded database. If using a reverse proxy,
configure trusted proxy handling explicitly so `request.client.host` represents
the intended client identity. Application code does not independently trust
arbitrary forwarded-header values. A proxy that presents every user as the same
address will group repeated attempts by address plus email, not lock out every
user behind that proxy.

Code rollback can leave the additive tables in place. No destructive database
downgrade is needed to roll back the application code. Rolling back the backend
also removes the new revocation checks and restores the old security behavior.

## Verification

The regression suite checks that removing shared listings preserves both users'
applications, ownership validation is atomic, existing malformed links do not
leak data, existing short passwords still sign in, legacy tokens remain valid,
logout only revokes the selected token, login limits expire and do not block
other accounts, and malformed JWT subjects return 401. SQLite migration checks
cover both fresh and already-created schemas. Real PostgreSQL integration checks
require `POSTGRES_TEST_URL` and are skipped when it is unavailable.

Production hosting, private SMTP usage, external credential-key management,
dependency advisories, and browser security headers remain outside this change.
