BEGIN;
CREATE TABLE IF NOT EXISTS contract_matters (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  matter_key TEXT NOT NULL,
  name TEXT NOT NULL,
  privilege_level TEXT NOT NULL CHECK (privilege_level IN ('standard','confidential','privileged')),
  retention_until DATE,
  legal_hold BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, matter_key)
);
CREATE TABLE IF NOT EXISTS governed_contracts (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  matter_id UUID NOT NULL REFERENCES contract_matters(id),
  idempotency_key TEXT NOT NULL,
  title TEXT NOT NULL,
  counterparty TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'intake' CHECK (state IN ('intake','draft','redline','approval','signature_pending','executed','active','renewal_review','expired','terminated')),
  playbook_version TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS contract_document_versions (
  id UUID PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES governed_contracts(id),
  tenant_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  object_uri TEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  source_version_id UUID REFERENCES contract_document_versions(id),
  immutable BOOLEAN NOT NULL DEFAULT true,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contract_id, version_number), UNIQUE (tenant_id, sha256)
);
CREATE TABLE IF NOT EXISTS contract_clause_findings (
  id UUID PRIMARY KEY,
  document_version_id UUID NOT NULL REFERENCES contract_document_versions(id),
  tenant_id TEXT NOT NULL,
  clause_key TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  page_reference TEXT NOT NULL,
  playbook_rule TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  human_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (human_status IN ('unreviewed','accepted','corrected','rejected')),
  reviewer_id TEXT
);
CREATE TABLE IF NOT EXISTS contract_obligation_register (
  id UUID PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES governed_contracts(id),
  tenant_id TEXT NOT NULL,
  description TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  owner_id TEXT NOT NULL,
  source_document_version_id UUID NOT NULL REFERENCES contract_document_versions(id),
  source_citation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','satisfied','waived','overdue'))
);
CREATE TABLE IF NOT EXISTS contract_approval_events (
  id BIGSERIAL PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES governed_contracts(id),
  tenant_id TEXT NOT NULL,
  gate TEXT NOT NULL CHECK (gate IN ('legal','business','privacy','security','finance','signature')),
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  rationale TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  document_version_id UUID NOT NULL REFERENCES contract_document_versions(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS contract_integration_outbox (
  id UUID PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES governed_contracts(id),
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivering','delivered','failed','dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  provider_reference TEXT,
  next_attempt_at TIMESTAMPTZ,
  UNIQUE (tenant_id, provider, idempotency_key)
);
CREATE TABLE IF NOT EXISTS contract_audit_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  matter_id UUID NOT NULL REFERENCES contract_matters(id),
  contract_id UUID REFERENCES governed_contracts(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_governed_contract_tenant_state ON governed_contracts(tenant_id,state);
CREATE INDEX IF NOT EXISTS idx_contract_outbox_retry ON contract_integration_outbox(status,next_attempt_at);
COMMIT;
