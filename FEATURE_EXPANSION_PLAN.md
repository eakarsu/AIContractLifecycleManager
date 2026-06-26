# Feature Expansion Plan

Target product: Legal Contract + Due Diligence Copilot

## 1. Contract Upload
- Upload contracts, amendments, schedules, exhibits, and diligence files.
- Backend tables: `contract_upload_batches`, `contract_file_extractions`.
- UI entry points: Documents, Contracts.

## 2. Clause Extraction
- Extract clause types, section numbers, risky language, obligations, and negotiation positions.
- Backend tables: `clause_extractions`, `clause_extraction_findings`.
- UI entry points: Clauses, AI Assistant.

## 3. Risk Matrix
- Score legal, financial, operational, privacy, renewal, and compliance risk.
- Backend tables: `contract_risk_matrices`, `risk_matrix_factors`.
- UI entry points: Risk Assessment, Dashboard.

## 4. Redline Suggestions
- Generate alternative clause language, fallback positions, and negotiation rationale.
- Backend tables: `redline_suggestions`, `redline_versions`.
- UI entry points: AI Advanced, Clauses.

## 5. Diligence Checklist
- Track diligence requests, owner, source document, status, exceptions, and reviewer signoff.
- Backend tables: `diligence_checklists`, `diligence_items`, `diligence_exceptions`.
- UI entry points: eDiscovery, Evidence Room.

## 6. Obligation Tracker
- Track obligations, due dates, recurring requirements, owner, evidence, and escalation.
- Backend tables: `obligation_events`, `obligation_evidence`.
- UI entry points: Obligations, Evidence Room.

## 7. Deal Room Q&A
- Add question routing, evidence references, answer approval, and exported Q&A log.
- Backend tables: `deal_room_questions`, `deal_room_answers`, `deal_room_references`.
- UI entry points: eDiscovery, AI Assistant.

## 8. Exportable Legal Summary
- Generate executive summary, red flags, obligations, renewal risks, and diligence exceptions.
- Backend tables: `legal_summary_exports`, `summary_generation_jobs`.
- UI entry points: Reports, Dashboard.
