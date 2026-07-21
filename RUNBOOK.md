# Governed contract lifecycle runbook

`start.sh` only starts already-installed processes and stops only its child PIDs. Installation, migrations, and explicitly confirmed non-production seeding are separated in `scripts/`. Copy `.env.example`, use a dedicated database role, and rotate every credential before deployment.

The governed migration adds tenant/matter isolation, privilege and retention metadata, immutable document hashes and versions, cited clause findings, obligation provenance, latest-version approval gates, integration outbox failures, and append-only audit events. Generated `gap_*` endpoints are not mounted. E-signature, storage/OCR, CRM, procurement, calendar, identity, and matter-system operations remain provider adapters and must return durable receipts; no LLM output is an executed redline or legal approval.

Before production: validate OCR/redline/export fidelity on licensed documents, test cross-tenant and privileged-matter denial, rehearse legal holds and retention, reconcile signature callbacks, and obtain counsel/security/privacy approval. This repository does not provide legal advice or professional validation.
