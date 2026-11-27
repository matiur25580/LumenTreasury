# Identity and tenant API

Base path: `/api/v1`. JSON error responses use `{ "error": { "code", "message" } }`; successful responses use `{ "data": ... }`.

## Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Create a user, first organization, and owner membership |
| POST | `/auth/login` | Verify credentials and issue access token + refresh cookie |
| POST | `/auth/refresh` | Rotate the HttpOnly refresh cookie and issue a new access token |
| POST | `/auth/logout` | Revoke the presented refresh session and clear its cookie |
| GET | `/auth/me` | Return the authenticated profile and active organizations |

Registration body:

```json
{
  "fullName": "Avery Morgan",
  "email": "avery@example.test",
  "password": "a-long-unique-password",
  "organizationName": "Northstar Holdings"
}
```

Passwords require at least 12 characters and are hashed with bcrypt. Access tokens are short-lived JWTs (15 minutes by default). Refresh tokens are opaque random values stored only as SHA-256 hashes, delivered in an HttpOnly cookie, and rotated on every refresh. The refresh cookie is scoped to `/api/v1/auth`; set `COOKIE_SECURE=true` behind HTTPS.

For protected routes send `Authorization: Bearer <accessToken>`. Never store the refresh token in browser local storage.

## Organizations and tenant context

| Method | Endpoint | Required role | Purpose |
|---|---|---|---|
| GET | `/organizations` | Any member | List the caller's active organizations |
| GET | `/organizations/current` | Any member | Resolve selected organization context |
| PATCH | `/organizations/current` | Owner or admin | Rename the selected organization |

Organization-scoped endpoints require `X-Organization-Id: <organizationId>`. The server resolves the caller's active membership for that organization on every request. A client-supplied organization ID is only a selector; it is never proof of access.

Roles currently defined: `owner`, `admin`, `treasury_manager`, `analyst`, and `viewer`. Access is deny-by-default. The initial organization settings endpoint permits only owner/admin.

## Environment

- `JWT_ACCESS_SECRET`: required, minimum 32 characters; use a cryptographically random secret.
- `ACCESS_TOKEN_TTL`: access token lifetime (default `15m`).
- `REFRESH_TOKEN_DAYS`: refresh session lifetime (1–30 days, default 7).
- `COOKIE_SECURE`: `true` in HTTPS production.
- `MONGODB_URI`: MongoDB connection string.

## Current limitations

This milestone provides the identity and tenancy foundation, not a complete enterprise identity program. Email verification, password reset, MFA/WebAuthn, invitation acceptance, SSO/SAML, device/session management UI, and formal security testing are planned follow-ups. Registration currently provisions one initial organization for the new account. Use synthetic data; this project is not a production financial service.
