# Transaction Intelligence

Milestone 4 adds tenant-scoped statement imports and a normalized transaction ledger.

## CSV upload

Use multipart `POST /api/v1/treasury/imports` with `file` and `bankAccountId`. Files are limited to 2 MiB, CSV only, and 5,000 data rows. Required headers are `bookingDate,description,amount`; optional headers are `valueDate,currency,reference,counterparty`. Dates use ISO `YYYY-MM-DD`; amounts are signed decimal strings with up to four fractional digits. Negative values are outflows, positive values inflows. Currency must match the selected active bank account.

The API parses the upload in memory, validates each row, and stores a tenant-scoped import batch with row-level errors. The raw file is not persisted.

## Commit and transaction ledger

Commit a validated batch using `POST /api/v1/treasury/imports/:id/commit`. A deterministic SHA-256 dedupe key and unique organization/account/key index prevent duplicate transactions. Replaying a completed batch returns the prior result. Amounts use MongoDB Decimal128; aggregate totals are serialized as decimal strings.

- `GET /api/v1/treasury/imports?page=1&limit=25`: import history
- `GET /api/v1/treasury/transactions`: paginated transactions; optional filters: bankAccountId, category, reconciliationStatus, from, to
- `PATCH /api/v1/treasury/transactions/:id/category`: classify a transaction
- `PATCH /api/v1/treasury/transactions/:id/reconcile`: manually link/unlink to an operator-supplied external ledger reference

All routes require authentication and X-Organization-Id. Reads are available to active members. Upload and categorization allow owner/admin/treasury_manager/analyst. Commit and reconciliation require owner/admin/treasury_manager. All records and operations are tenant-scoped and audited.

## Production hardening boundary

This is a bounded MVP, not a live bank feed. CSV bytes are parsed synchronously in API memory. Before production use, add durable object storage, malware scanning, streaming parsing, asynchronous queues, retry/dead-letter handling, concurrency controls, and operational monitoring. Manual reconciliation records a supplied reference; it does not reconcile against a first-party general ledger. No bank credentials, full account numbers, payment initiation, or live banking connections are supported.
