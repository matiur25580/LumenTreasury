# LumenTreasury

**Enterprise Treasury, Liquidity & Working Capital Intelligence Platform**

See every balance. Anticipate every risk. Make smarter financial decisions.

LumenTreasury is a MERN-based enterprise treasury workspace for multi-entity organizations. It is designed to consolidate cash visibility, model liquidity scenarios, govern treasury workflows, and provide explainable decision support.

> **Development status:** Early development. This repository is not a production financial system. Initial releases use synthetic/demo data and simulated bank/payment integrations. No real funds are moved.

## Product goals

- Consolidated cash positions across legal entities, bank accounts, and currencies.
- Importable and reconcilable transaction activity with traceable source records.
- Cash-flow forecasting with transparent assumptions and scenario comparisons.
- Liquidity, working-capital, FX exposure, debt, and investment visibility.
- Governed payment requests with maker-checker approvals and immutable-style audit history.
- Tenant isolation, granular RBAC, secure APIs, and operational observability.

## Planned architecture

- **Web:** React, TypeScript, Vite, accessible component system, data visualizations.
- **API:** Node.js, Express, TypeScript, REST/OpenAPI.
- **Data:** MongoDB with tenant-scoped schemas, indexes, and transaction-safe workflows.
- **Jobs/cache:** Redis and BullMQ for imports, reconciliation, forecasting, and notifications.
- **Realtime:** Socket.IO for operational updates.
- **Quality:** Unit/integration tests, linting, type checking, CI, Docker-based local development.

## Development roadmap

1. Enterprise foundation: monorepo, API/web shells, configuration, health checks, Docker, CI, and engineering standards.
2. Identity and tenancy: authentication, organizations, memberships, RBAC, tenant isolation, audit events.
3. Treasury master data: entities, bank registry, accounts, currencies, account ownership.
4. Transaction intelligence: statement imports, normalized transactions, reconciliation, cash positions.
5. Treasury command center: dashboards, reporting, realtime updates.
6. Cash forecasting and scenario planning.
7. Liquidity and working-capital intelligence.
8. FX exposure and financial risk.
9. Debt and investment management.
10. Payment governance and simulated execution.
11. Decision intelligence and anomaly detection.
12. Integrations, hardening, deployment, and operational readiness.

## Security principles

- Enforce tenant scope on the server; never trust a tenant identifier supplied by the client.
- Use least-privilege authorization and deny-by-default access checks.
- Store secrets only in environment variables or a secrets manager.
- Use decimal-safe monetary arithmetic and explicit currency codes.
- Require idempotency and approval controls for sensitive workflows.
- Keep audit events append-only and avoid logging credentials or sensitive financial data.
- Treat AI output as advisory; require authorized human approval for consequential actions.

## Local development

Setup instructions will be added with the first implementation milestone. Never use real banking credentials or production financial data in local/demo environments.

## License

License to be selected before public distribution.
