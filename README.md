# LumenTreasury

**Enterprise Treasury, Liquidity & Working Capital Intelligence Platform**

See every balance. Anticipate every risk. Make smarter financial decisions.

LumenTreasury is a MERN-based enterprise treasury workspace for multi-entity organizations. It is designed to consolidate cash visibility, model liquidity scenarios, govern treasury workflows, and provide explainable decision support.

> **Development status:** Early development. The current interface is a foundation preview, not a production financial system. Initial releases use synthetic/demo data and simulated bank/payment integrations. No real funds are moved.

## Current foundation

- Email/password identity with bcrypt password hashing, short-lived JWT access tokens, and rotating opaque refresh sessions in HttpOnly cookies.
- Organization provisioning, membership roles, server-validated tenant context, and append-only identity/organization audit events.
- Organization-scoped legal entity, bank, and bank-account registries with role-aware CRUD, pagination, audit events, and soft deactivation.
- CSV statement import validation, row-level error reporting, idempotent transaction ingestion, Decimal128 money storage, categorization, and manual reconciliation references.
- Login/registration/refresh rate limits and strict request validation.
- React + TypeScript + Vite treasury workspace shell.
- Express + TypeScript API with Helmet, CORS, JSON limits, and a versioned health endpoint.
- MongoDB and Redis local services through Docker Compose.
- npm workspaces and GitHub Actions typecheck/build pipeline.
- Responsive dark enterprise interface with clearly labelled demo-only state.

## Local development

Requirements: Node.js 20.11+, npm 10+, and Docker Compose.

1. Copy .env.example to .env.
2. Start infrastructure with: docker compose up -d
3. Install dependencies with: npm install
4. Start API and web with: npm run dev
5. Open http://localhost:5173; API health is at http://localhost:4000/api/v1/health.

## Planned product capabilities

- Consolidated cash positions across legal entities, bank accounts, and currencies.
- Importable and reconcilable transaction activity with traceable source records.
- Cash-flow forecasting with transparent assumptions and scenario comparisons.
- Liquidity, working-capital, FX exposure, debt, and investment visibility.
- Governed payment requests with maker-checker approvals and audit history.
- Tenant isolation, granular RBAC, secure APIs, and operational observability.

## Roadmap

1. Enterprise foundation: monorepo, API/web shells, configuration, health checks, Docker, CI, and engineering standards.
2. Identity and tenancy: authentication, organizations, memberships, RBAC, tenant isolation, audit events.
3. Treasury master data: entities, bank registry, accounts, currencies, account ownership.
4. Transaction intelligence: statement imports, normalized transactions, reconciliation workflow (initial API implementation in progress).
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

## Financial safety

This project is an engineering portfolio application. Use synthetic data and sandbox integrations only. It does not provide regulated financial advice, and no production payment execution is implemented.

## License

License to be selected before public distribution.
