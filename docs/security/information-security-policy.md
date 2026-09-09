# Information Security Policy — Personal OS

**Owner:** Max Allaire, Founder & sole operator
**Contact:** max@elosolutions.org (actively monitored)
**Effective date:** 2026-06-07
**Review cadence:** Reviewed at least annually, and whenever a new third-party data integration is added.

## 1. Scope & Context

Personal OS is a **single-user personal finance and health dashboard** operated solely by its founder. There are no other employees, contractors, or end-users with access to the system or its data. This policy documents the security practices that are operationalized in the application and its infrastructure to identify, mitigate, and monitor information security risks.

## 2. Governance & Risk Management

- The founder is solely responsible for information security, infrastructure, and incident response.
- Third-party data integrations (e.g., financial and health providers) are added deliberately, each scoped to the minimum data products required (e.g., Plaid is limited to the `transactions` product only — no Auth, Identity, or Income).
- Before any integration handling sensitive data is enabled, its credential storage, access scoping, and data-handling path are reviewed against this policy.

## 3. Identity & Access Management

- **Single authorized operator.** Only the founder has access to production systems and data. No shared credentials are used.
- **Multi-factor authentication (MFA)** is enabled on all administrative cloud accounts that can reach production assets or secrets: the hosting platform (Vercel), the database/auth platform (Supabase), and source control (GitHub).
- **Least privilege.** The high-privilege database service-role credential is used only in trusted server-side contexts and is never exposed to the client. Day-to-day application data access runs under per-user, row-level-scoped credentials.
- **End-user authentication.** Application access is gated behind passwordless email magic-link authentication before any sensitive surface (including the Plaid Link flow) is reachable.

## 4. Data Protection

- **Encryption in transit.** All traffic is served exclusively over HTTPS/TLS.
- **Encryption at rest.** Third-party access tokens and other sensitive credentials are encrypted at rest using **AES-256-GCM** (authenticated encryption with a unique random initialization vector and authentication tag per record). Encryption keys are held only as environment secrets, never committed to source control.
- **Row-Level Security (RLS).** Every database table enforces row-level security policies so that data is isolated to its owning user. Server-side jobs that bypass RLS (scheduled syncs, webhooks) explicitly scope every read and write by user identity.
- **Data minimization for financial data.** Account balances and transactions are treated as the most sensitive data class. Financial PII (amounts, merchant names, account numbers, raw provider payloads) is never written to application logs, error records, or observability tooling — only counts and stage tags are logged.
- **Secrets management.** All API keys, secrets, and encryption keys are stored as platform environment variables (server-side only). No secrets are hard-coded or committed to the repository.

## 5. Application Security

- The application validates inputs at trust boundaries and uses parameterized database queries exclusively (no string-interpolated SQL).
- Inbound webhooks carrying financial data are cryptographically verified (signature validation, timestamp-freshness checks, and constant-time body-hash comparison) before any action is taken; unverified requests are rejected without a data write.
- Provider access tokens are decrypted only in-memory at the moment of use and are never returned to the client.

## 6. Monitoring & Logging

- Integration sync runs and error events are recorded in a dedicated observability layer (with financial PII excluded) to detect failures and anomalous behavior.
- Application and infrastructure logs are available through the hosting and database platforms.

## 7. Vendor & Infrastructure Security

- Infrastructure is built on established, SOC-2-compliant platforms: **Vercel** (application hosting) and **Supabase** (managed PostgreSQL, authentication, and storage). The application relies on these providers' physical, network, and platform security controls.

## 8. Incident Response

- In the event of a suspected credential compromise, the affected secrets and access tokens are rotated immediately, the relevant provider integration is revoked/disconnected, and affected linked items are re-authenticated.
- Because the system is single-user, the operator is both the detector and responder; there is no third-party data exposure surface beyond the operator's own accounts.

## 9. Data Retention & Deletion

- Disconnecting a third-party integration revokes the provider's access (e.g., Plaid `/item/remove`) and deletes the provider-owned data from the application database.

---

*This policy reflects the security practices operationalized in the Personal OS application as of the effective date above. It is maintained by the sole operator and reviewed on the cadence stated in the header.*
