# Treasury master data API

Base path: `/api/v1/treasury`. Every endpoint requires a valid access token and an `X-Organization-Id` header. The organization ID is a selector only: the API verifies the authenticated user's active membership and organization status before querying data. Every database query is additionally scoped by `organizationId`.

All successful responses use a `data` property. Collection responses include `pagination: { page, limit, total, pages }`. Page defaults to 1, limit defaults to 25, and limit is capped at 100.

## Authorization

| Operation | Allowed roles |
|---|---|
| List and read entities, banks, and accounts | Any active organization member |
| Create and update entities, banks, and accounts | owner, admin, treasury_manager |
| Deactivate entities, banks, and accounts | owner, admin |

Records are deactivated rather than hard-deleted so future transactions and audit history can retain their references.

## Legal entities

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/entities?page=1&limit=25&status=active` | List legal entities |
| POST | `/entities` | Create legal entity |
| PATCH | `/entities/:id` | Update legal entity |
| DELETE | `/entities/:id` | Deactivate legal entity |

Create body:

```json
{
  "code": "NORTHSTAR-UK",
  "name": "Northstar Holdings UK Ltd",
  "countryCode": "GB",
  "functionalCurrency": "GBP",
  "parentEntityId": null
}
```

Entity codes are unique within an organization. Parent entities must be active and belong to the same organization. Updates reject circular hierarchies. An entity with active bank accounts cannot be deactivated until those accounts are reassigned or deactivated.

## Bank registry

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/banks?page=1&limit=25&status=active` | List banks |
| POST | `/banks` | Register a bank |
| PATCH | `/banks/:id` | Update bank metadata |
| DELETE | `/banks/:id` | Deactivate bank |

Create body:

```json
{
  "code": "NORTHSTAR-UK-BANK",
  "name": "Example Commercial Bank",
  "countryCode": "GB",
  "swiftBic": "EXAMGB2L",
  "routingCode": null
}
```

SWIFT/BIC is validated as an 8- or 11-character identifier. Bank codes are unique within an organization. A bank with active accounts cannot be deactivated.

## Bank accounts

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/accounts?page=1&limit=25&status=active` | List bank accounts; supports `legalEntityId` filter |
| POST | `/accounts` | Register a bank account |
| PATCH | `/accounts/:id` | Update account metadata |
| DELETE | `/accounts/:id` | Deactivate account |

Create body:

```json
{
  "legalEntityId": "65a000000000000000000001",
  "bankId": "65a000000000000000000002",
  "accountReference": "UK-OPERATING-GBP-01",
  "accountName": "UK Operating Account",
  "accountLast4": "4821",
  "accountType": "operating",
  "currency": "GBP"
}
```

Supported account types: `operating`, `payroll`, `tax`, `reserve`, `escrow`, `other`. Account status is `active`, `inactive`, or `closed`. Account creation and reassignment verify that both the legal entity and bank are active records in the selected organization.

**Sensitive data boundary:** this milestone deliberately does not accept or store full account numbers, IBANs, online banking credentials, card data, or payment credentials. It stores an internal account reference and optional last four digits only. Secure account-number vaulting, encryption/key management, and bank connectivity require a separately reviewed design.

## Audit and data integrity

Create, update, and deactivate operations append an `AuditEvent` with the organization, actor, action, resource ID, changed-field metadata, and request IP. Tenant-scoped compound indexes support organization-local uniqueness and lookup. Duplicate keys return a conflict response through the shared API error handler.

## Example request

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Organization-Id: $ORGANIZATION_ID" \
  http://localhost:4000/api/v1/treasury/entities
```

Use synthetic organization, bank, and account metadata in development. No live banking connection or payment execution is implemented.
