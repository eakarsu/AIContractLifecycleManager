require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const pool = require('../db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('Seeding AI Contract Lifecycle Manager...');

  await pool.query(`
    DROP TABLE IF EXISTS conversation_messages, conversations, audit_log, documents, milestones,
      compliance_checks, risk_assessments, renewals, amendments, approvals, obligations,
      parties, contract_templates, clauses, contracts, settings, users CASCADE;
  `);

  await pool.query(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) DEFAULT 'Admin',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE contracts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      contract_type VARCHAR(100) DEFAULT 'service_agreement',
      status VARCHAR(50) DEFAULT 'draft',
      party_a VARCHAR(255),
      party_b VARCHAR(255),
      value NUMERIC(15,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'USD',
      start_date DATE,
      end_date DATE,
      jurisdiction VARCHAR(100),
      description TEXT,
      risk_level VARCHAR(20) DEFAULT 'medium',
      tags_json JSONB DEFAULT '[]',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE clauses (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      clause_type VARCHAR(100),
      content TEXT,
      plain_language TEXT,
      severity VARCHAR(20) DEFAULT 'standard',
      is_negotiable BOOLEAN DEFAULT true,
      contract_id INTEGER,
      section_number VARCHAR(20),
      variations JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE contract_templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      template_type VARCHAR(100),
      description TEXT,
      content TEXT,
      jurisdiction VARCHAR(100) DEFAULT 'United States',
      industry VARCHAR(100),
      variables JSONB DEFAULT '[]',
      sections JSONB DEFAULT '[]',
      usage_count INTEGER DEFAULT 0,
      is_public BOOLEAN DEFAULT true,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE parties (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      party_type VARCHAR(50) DEFAULT 'company',
      email VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      jurisdiction VARCHAR(100),
      tax_id VARCHAR(100),
      industry VARCHAR(100),
      contacts JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'active',
      contracts_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE obligations (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      obligated_party VARCHAR(255),
      obligation_type VARCHAR(50) DEFAULT 'performance',
      due_date DATE,
      frequency VARCHAR(50) DEFAULT 'one-time',
      status VARCHAR(50) DEFAULT 'pending',
      priority VARCHAR(20) DEFAULT 'medium',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE approvals (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER,
      approver_name VARCHAR(255),
      approver_email VARCHAR(255),
      approval_type VARCHAR(50) DEFAULT 'review',
      status VARCHAR(50) DEFAULT 'pending',
      comments TEXT,
      decision_date TIMESTAMP,
      priority VARCHAR(20) DEFAULT 'normal',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE amendments (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      amendment_type VARCHAR(50) DEFAULT 'modification',
      changes JSONB DEFAULT '[]',
      effective_date DATE,
      status VARCHAR(50) DEFAULT 'draft',
      requested_by VARCHAR(255),
      approved_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE renewals (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER,
      renewal_type VARCHAR(50) DEFAULT 'manual',
      new_start_date DATE,
      new_end_date DATE,
      new_value NUMERIC(15,2),
      terms_changed BOOLEAN DEFAULT false,
      notice_date DATE,
      status VARCHAR(50) DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE risk_assessments (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER,
      title VARCHAR(500) NOT NULL,
      overall_score INTEGER DEFAULT 50,
      risk_level VARCHAR(20) DEFAULT 'medium',
      financial_risk INTEGER DEFAULT 50,
      legal_risk INTEGER DEFAULT 50,
      operational_risk INTEGER DEFAULT 50,
      compliance_risk INTEGER DEFAULT 50,
      risk_factors JSONB DEFAULT '[]',
      mitigation_steps JSONB DEFAULT '[]',
      assessor VARCHAR(255),
      status VARCHAR(50) DEFAULT 'completed',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE compliance_checks (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER,
      title VARCHAR(500) NOT NULL,
      regulation VARCHAR(100),
      compliance_score INTEGER DEFAULT 0,
      status VARCHAR(50) DEFAULT 'pending',
      findings JSONB DEFAULT '[]',
      regulations JSONB DEFAULT '[]',
      checked_by VARCHAR(255),
      next_review DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE milestones (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      milestone_type VARCHAR(50) DEFAULT 'deliverable',
      due_date DATE,
      completed_date DATE,
      status VARCHAR(50) DEFAULT 'pending',
      payment_amount NUMERIC(15,2) DEFAULT 0,
      responsible_party VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE documents (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER,
      title VARCHAR(500) NOT NULL,
      document_type VARCHAR(50) DEFAULT 'contract',
      file_name VARCHAR(500),
      file_size VARCHAR(50),
      version VARCHAR(20) DEFAULT '1.0',
      uploaded_by VARCHAR(255),
      metadata JSONB DEFAULT '{}',
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE audit_log (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER,
      action VARCHAR(100),
      entity_type VARCHAR(50),
      entity_id INTEGER,
      performed_by VARCHAR(255),
      ip_address VARCHAR(50),
      details JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(255) UNIQUE NOT NULL,
      value TEXT,
      category VARCHAR(100) DEFAULT 'general',
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE conversations (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500),
      model VARCHAR(200),
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE conversation_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES conversations(id),
      role VARCHAR(50),
      content TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const hash = await bcrypt.hash(process.env.DEFAULT_PASSWORD || 'admin123', 10);
  await pool.query('INSERT INTO users (email, password, name) VALUES ($1, $2, $3)',
    [process.env.DEFAULT_EMAIL || 'admin@contractai.com', hash, 'Admin User']);

  // Contracts
  const contracts = [
    ['Master Services Agreement - TechCorp', 'service_agreement', 'active', 'Acme Inc', 'TechCorp Solutions', 250000, 'USD', '2024-01-01', '2025-12-31', 'Delaware, USA', 'Comprehensive IT consulting and development services', 'low', '["technology","consulting"]'],
    ['Software License Agreement - DataFlow', 'license_agreement', 'active', 'Acme Inc', 'DataFlow Analytics', 180000, 'USD', '2024-03-15', '2025-03-14', 'California, USA', 'Enterprise data analytics platform license', 'low', '["software","license"]'],
    ['Employment Contract - Senior Developer', 'employment', 'executed', 'Acme Inc', 'John Smith', 145000, 'USD', '2024-02-01', '2025-01-31', 'New York, USA', 'Full-time senior software developer position', 'low', '["employment","engineering"]'],
    ['Non-Disclosure Agreement - ProjectX', 'nda', 'active', 'Acme Inc', 'Innovation Labs', 0, 'USD', '2024-01-15', '2026-01-14', 'Delaware, USA', 'Mutual NDA for joint development project', 'medium', '["nda","confidential"]'],
    ['Cloud Infrastructure Agreement', 'service_agreement', 'active', 'Acme Inc', 'CloudScale Inc', 96000, 'USD', '2024-04-01', '2025-03-31', 'Washington, USA', 'AWS managed services and infrastructure', 'medium', '["cloud","infrastructure"]'],
    ['Office Lease Agreement', 'lease', 'active', 'Acme Inc', 'Pinnacle Properties', 360000, 'USD', '2024-01-01', '2026-12-31', 'New York, USA', 'Corporate headquarters lease - 15,000 sq ft', 'medium', '["real-estate","lease"]'],
    ['Vendor Supply Agreement', 'supply_agreement', 'under_review', 'Acme Inc', 'GlobalParts Co', 520000, 'USD', '2024-06-01', '2025-05-31', 'Illinois, USA', 'Hardware components supply for manufacturing', 'high', '["supply","manufacturing"]'],
    ['Marketing Agency Contract', 'service_agreement', 'draft', 'Acme Inc', 'BrandSpark Agency', 150000, 'USD', '2024-07-01', '2025-06-30', 'California, USA', 'Digital marketing and brand strategy services', 'low', '["marketing","agency"]'],
    ['Partnership Agreement - APAC Expansion', 'partnership', 'negotiation', 'Acme Inc', 'AsiaConnect Ltd', 1200000, 'USD', '2024-09-01', '2027-08-31', 'Singapore', 'Strategic partnership for Asia-Pacific market entry', 'high', '["partnership","international"]'],
    ['Data Processing Agreement', 'dpa', 'active', 'Acme Inc', 'SecureData Corp', 48000, 'USD', '2024-03-01', '2025-02-28', 'EU - GDPR', 'GDPR-compliant data processing services', 'high', '["data","gdpr","compliance"]'],
    ['Consulting Framework Agreement', 'framework', 'active', 'Acme Inc', 'McKinley Consulting', 400000, 'USD', '2024-02-15', '2025-02-14', 'Massachusetts, USA', 'Strategic consulting engagement framework', 'medium', '["consulting","strategy"]'],
    ['Insurance Policy - D&O', 'insurance', 'active', 'Acme Inc', 'Shield Insurance Group', 75000, 'USD', '2024-01-01', '2024-12-31', 'Connecticut, USA', 'Directors and officers liability insurance', 'low', '["insurance","liability"]'],
    ['Joint Venture Agreement - GreenTech', 'joint_venture', 'draft', 'Acme Inc', 'EcoVentures Corp', 2500000, 'USD', '2024-10-01', '2029-09-30', 'Colorado, USA', 'Clean energy technology joint venture', 'high', '["joint-venture","cleantech"]'],
    ['API Integration Agreement', 'integration', 'active', 'Acme Inc', 'PaymentPro Inc', 36000, 'USD', '2024-05-01', '2025-04-30', 'Delaware, USA', 'Payment processing API integration and usage', 'medium', '["api","payments","integration"]'],
    ['Construction Contract - New Office', 'construction', 'pending', 'Acme Inc', 'BuildRight Construction', 4800000, 'USD', '2025-01-15', '2026-06-30', 'Texas, USA', 'New regional office building construction', 'high', '["construction","real-estate"]'],
  ];
  for (const c of contracts) {
    await pool.query('INSERT INTO contracts (title,contract_type,status,party_a,party_b,value,currency,start_date,end_date,jurisdiction,description,risk_level,tags_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)', c);
  }

  // Clauses
  const clauses = [
    ['Confidentiality and Non-Disclosure', 'confidentiality', 'Each party agrees to maintain the confidentiality of all Proprietary Information disclosed by the other party. Neither party shall disclose, publish, or disseminate Proprietary Information to any third party without prior written consent.', 'Keep all shared business information private and do not share it with others.', 'critical', true, 1, '2.1', '[]', 'active'],
    ['Limitation of Liability', 'liability', 'IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, REGARDLESS OF THE CAUSE OF ACTION OR THEORY OF LIABILITY. Total aggregate liability shall not exceed the fees paid in the twelve months preceding the claim.', 'Maximum financial responsibility is limited to 12 months of fees paid.', 'critical', false, 1, '8.1', '[]', 'active'],
    ['Intellectual Property Ownership', 'ip_ownership', 'All intellectual property created by Service Provider in performance of this Agreement shall be the exclusive property of the Client. Service Provider hereby assigns all rights, title, and interest in such work product.', 'The client owns all work created during the project.', 'critical', true, 1, '5.1', '[]', 'active'],
    ['Termination for Convenience', 'termination', 'Either party may terminate this Agreement for any reason upon sixty (60) days prior written notice to the other party. Upon termination, all outstanding fees shall become immediately due and payable.', 'Either side can end the contract with 60 days notice.', 'high', true, 1, '9.1', '[]', 'active'],
    ['Force Majeure', 'force_majeure', 'Neither party shall be liable for any failure or delay in performance due to circumstances beyond its reasonable control, including but not limited to acts of God, natural disasters, pandemic, war, terrorism, or government action.', 'Neither side is responsible for delays caused by uncontrollable events.', 'standard', false, 1, '10.1', '[]', 'active'],
    ['Payment Terms', 'payment', 'Client shall pay all undisputed invoices within thirty (30) days of receipt. Late payments shall accrue interest at the rate of 1.5% per month or the maximum rate permitted by law, whichever is less.', 'Pay invoices within 30 days; late payments have 1.5% monthly interest.', 'high', true, 1, '4.1', '[]', 'active'],
    ['Indemnification', 'indemnification', 'Service Provider shall indemnify, defend, and hold harmless Client from any claims, damages, losses, or expenses arising from Service Provider breach of this Agreement or negligent acts.', 'The service provider will cover costs if their actions cause legal problems.', 'critical', true, 2, '7.1', '[]', 'active'],
    ['Data Protection and Privacy', 'data_protection', 'Both parties shall comply with all applicable data protection laws, including GDPR and CCPA. Personal data shall be processed only for the purposes specified in this Agreement.', 'Both sides must follow data privacy laws like GDPR and CCPA.', 'critical', false, 10, '6.1', '[]', 'active'],
    ['Warranty of Services', 'warranty', 'Service Provider warrants that all services will be performed in a professional and workmanlike manner consistent with generally accepted industry standards.', 'Services will be done professionally and to industry standards.', 'high', true, 1, '3.1', '[]', 'active'],
    ['Non-Solicitation', 'non_solicitation', 'During the term and for twelve (12) months following termination, neither party shall solicit for employment any employee of the other party who was involved in the performance of this Agreement.', 'Cannot hire each other employees for 12 months after contract ends.', 'standard', true, 3, '11.1', '[]', 'active'],
    ['Governing Law', 'governing_law', 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws provisions.', 'Delaware law applies to this contract.', 'standard', false, 1, '12.1', '[]', 'active'],
    ['Assignment', 'assignment', 'Neither party may assign or transfer this Agreement or any rights hereunder without the prior written consent of the other party, except in connection with a merger, acquisition, or sale of all assets.', 'Cannot transfer this contract to someone else without permission.', 'standard', true, 1, '13.1', '[]', 'active'],
    ['Dispute Resolution', 'dispute_resolution', 'Any dispute arising out of this Agreement shall first be submitted to mediation. If mediation fails within 30 days, the dispute shall be resolved by binding arbitration under AAA rules.', 'Disagreements go to mediation first, then arbitration if needed.', 'high', true, 1, '14.1', '[]', 'active'],
    ['Insurance Requirements', 'insurance', 'Service Provider shall maintain commercial general liability insurance with limits of not less than $2,000,000 per occurrence and $5,000,000 aggregate throughout the term.', 'Must carry at least $2M/$5M liability insurance.', 'high', false, 7, '15.1', '[]', 'active'],
    ['Audit Rights', 'audit', 'Client shall have the right to audit Service Provider records related to this Agreement upon reasonable notice during normal business hours, not more than once per calendar year.', 'Client can inspect records once a year with reasonable notice.', 'standard', true, 1, '16.1', '[]', 'active'],
  ];
  for (const c of clauses) {
    await pool.query('INSERT INTO clauses (title,clause_type,content,plain_language,severity,is_negotiable,contract_id,section_number,variations,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', c);
  }

  // Templates
  const tpls = [
    ['Master Services Agreement', 'service_agreement', 'Comprehensive MSA template for professional services', 'MASTER SERVICES AGREEMENT\n\nThis Master Services Agreement ("Agreement") is entered into as of [DATE]...', 'United States', 'technology', '[{"name":"COMPANY_NAME"},{"name":"CLIENT_NAME"},{"name":"EFFECTIVE_DATE"},{"name":"TERM_MONTHS"}]', '[{"title":"Definitions"},{"title":"Scope of Services"},{"title":"Payment"},{"title":"Confidentiality"}]', 234, true, 'active'],
    ['Non-Disclosure Agreement', 'nda', 'Mutual NDA for business discussions', 'MUTUAL NON-DISCLOSURE AGREEMENT\n\nThis NDA is entered into by and between [PARTY_A] and [PARTY_B]...', 'United States', 'general', '[{"name":"PARTY_A"},{"name":"PARTY_B"},{"name":"DURATION_YEARS"}]', '[{"title":"Definition of Confidential Information"},{"title":"Obligations"},{"title":"Exclusions"}]', 456, true, 'active'],
    ['Employment Agreement', 'employment', 'Standard employment contract with IP assignment', 'EMPLOYMENT AGREEMENT\n\nThis Agreement is made between [COMPANY] ("Employer") and [EMPLOYEE] ("Employee")...', 'United States', 'general', '[{"name":"COMPANY"},{"name":"EMPLOYEE"},{"name":"POSITION"},{"name":"SALARY"}]', '[{"title":"Position"},{"title":"Compensation"},{"title":"Benefits"},{"title":"Termination"}]', 189, true, 'active'],
    ['Software License Agreement', 'license', 'SaaS/software licensing template', 'SOFTWARE LICENSE AGREEMENT\n\nThis License Agreement governs the use of [SOFTWARE_NAME]...', 'United States', 'technology', '[{"name":"LICENSOR"},{"name":"LICENSEE"},{"name":"SOFTWARE_NAME"},{"name":"LICENSE_FEE"}]', '[{"title":"Grant of License"},{"title":"Restrictions"},{"title":"Fees"},{"title":"Support"}]', 167, true, 'active'],
    ['Data Processing Agreement', 'dpa', 'GDPR-compliant DPA template', 'DATA PROCESSING AGREEMENT\n\nThis DPA is entered into pursuant to Article 28 of the GDPR...', 'European Union', 'technology', '[{"name":"CONTROLLER"},{"name":"PROCESSOR"},{"name":"DATA_TYPES"}]', '[{"title":"Processing Details"},{"title":"Security"},{"title":"Sub-processors"},{"title":"Data Subject Rights"}]', 98, true, 'active'],
    ['Partnership Agreement', 'partnership', 'Business partnership formation agreement', 'PARTNERSHIP AGREEMENT\n\nThis Partnership Agreement is made by and between the undersigned partners...', 'United States', 'general', '[{"name":"PARTNER_A"},{"name":"PARTNER_B"},{"name":"BUSINESS_NAME"},{"name":"PROFIT_SPLIT"}]', '[{"title":"Formation"},{"title":"Capital"},{"title":"Management"},{"title":"Profits"},{"title":"Dissolution"}]', 76, true, 'active'],
    ['Independent Contractor Agreement', 'contractor', 'IC agreement with IP provisions', 'INDEPENDENT CONTRACTOR AGREEMENT\n\nThis Agreement is between [COMPANY] and [CONTRACTOR]...', 'United States', 'general', '[{"name":"COMPANY"},{"name":"CONTRACTOR"},{"name":"SCOPE"},{"name":"RATE"}]', '[{"title":"Services"},{"title":"Compensation"},{"title":"Independence"},{"title":"IP Assignment"}]', 203, true, 'active'],
    ['Lease Agreement - Commercial', 'lease', 'Commercial property lease template', 'COMMERCIAL LEASE AGREEMENT\n\nThis Lease is made between [LANDLORD] ("Lessor") and [TENANT] ("Lessee")...', 'United States', 'real_estate', '[{"name":"LANDLORD"},{"name":"TENANT"},{"name":"PROPERTY"},{"name":"MONTHLY_RENT"}]', '[{"title":"Premises"},{"title":"Term"},{"title":"Rent"},{"title":"Maintenance"},{"title":"Insurance"}]', 134, true, 'active'],
    ['Supply Agreement', 'supply', 'Product supply and distribution agreement', 'SUPPLY AGREEMENT\n\nThis Agreement governs the supply of [PRODUCTS] from [SUPPLIER] to [BUYER]...', 'United States', 'manufacturing', '[{"name":"SUPPLIER"},{"name":"BUYER"},{"name":"PRODUCTS"},{"name":"MINIMUM_ORDER"}]', '[{"title":"Products"},{"title":"Pricing"},{"title":"Delivery"},{"title":"Quality"},{"title":"Warranty"}]', 87, true, 'active'],
    ['Joint Venture Agreement', 'joint_venture', 'JV formation and governance template', 'JOINT VENTURE AGREEMENT\n\nThis JV Agreement is entered into by [PARTY_A] and [PARTY_B]...', 'United States', 'general', '[{"name":"PARTY_A"},{"name":"PARTY_B"},{"name":"JV_NAME"},{"name":"PURPOSE"}]', '[{"title":"Formation"},{"title":"Contributions"},{"title":"Management"},{"title":"Profits"},{"title":"Exit"}]', 45, true, 'active'],
    ['Consulting Agreement', 'consulting', 'Professional consulting engagement', 'CONSULTING AGREEMENT\n\nThis Agreement is between [CLIENT] and [CONSULTANT]...', 'United States', 'professional_services', '[{"name":"CLIENT"},{"name":"CONSULTANT"},{"name":"SCOPE"},{"name":"HOURLY_RATE"}]', '[{"title":"Engagement"},{"title":"Fees"},{"title":"Deliverables"},{"title":"Confidentiality"}]', 156, true, 'active'],
    ['Terms of Service', 'tos', 'Website/SaaS terms of service', 'TERMS OF SERVICE\n\nThese Terms govern your use of [SERVICE_NAME]...', 'United States', 'technology', '[{"name":"COMPANY"},{"name":"SERVICE_NAME"},{"name":"EFFECTIVE_DATE"}]', '[{"title":"Acceptance"},{"title":"Use Rights"},{"title":"Restrictions"},{"title":"Liability"},{"title":"Termination"}]', 312, true, 'active'],
    ['Severance Agreement', 'severance', 'Employee separation and release agreement', 'SEPARATION AND RELEASE AGREEMENT\n\nThis Agreement is between [COMPANY] and [EMPLOYEE]...', 'United States', 'human_resources', '[{"name":"COMPANY"},{"name":"EMPLOYEE"},{"name":"SEVERANCE_AMOUNT"},{"name":"RELEASE_PERIOD"}]', '[{"title":"Separation"},{"title":"Severance"},{"title":"Release"},{"title":"Non-Disparagement"}]', 34, false, 'active'],
    ['Distribution Agreement', 'distribution', 'Product distribution rights agreement', 'DISTRIBUTION AGREEMENT\n\nThis Agreement grants [DISTRIBUTOR] rights to distribute [PRODUCTS]...', 'United States', 'retail', '[{"name":"MANUFACTURER"},{"name":"DISTRIBUTOR"},{"name":"TERRITORY"},{"name":"PRODUCTS"}]', '[{"title":"Appointment"},{"title":"Territory"},{"title":"Pricing"},{"title":"Marketing"},{"title":"Term"}]', 67, true, 'active'],
    ['Merger Agreement', 'merger', 'Company merger/acquisition agreement', 'AGREEMENT AND PLAN OF MERGER\n\nThis Agreement is entered into by [ACQUIRER] and [TARGET]...', 'United States', 'corporate', '[{"name":"ACQUIRER"},{"name":"TARGET"},{"name":"PURCHASE_PRICE"},{"name":"CLOSING_DATE"}]', '[{"title":"The Merger"},{"title":"Consideration"},{"title":"Representations"},{"title":"Conditions"},{"title":"Indemnification"}]', 23, false, 'active'],
  ];
  for (const t of tpls) {
    await pool.query('INSERT INTO contract_templates (name,template_type,description,content,jurisdiction,industry,variables,sections,usage_count,is_public,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', t);
  }

  // Parties
  const parties = [
    ['TechCorp Solutions', 'company', 'contracts@techcorp.com', '+1-555-0101', '123 Tech Blvd, San Jose, CA 95110', 'California, USA', 'US-TC-123456', 'technology', '[{"name":"Sarah Chen","role":"General Counsel","email":"sarah@techcorp.com"}]', 'active', 3],
    ['DataFlow Analytics', 'company', 'legal@dataflow.io', '+1-555-0102', '456 Data Way, Seattle, WA 98101', 'Washington, USA', 'US-DF-789012', 'technology', '[{"name":"Mike Ross","role":"VP Legal","email":"mike@dataflow.io"}]', 'active', 2],
    ['Innovation Labs', 'company', 'info@innovlabs.com', '+1-555-0103', '789 Innovation Dr, Boston, MA 02101', 'Massachusetts, USA', 'US-IL-345678', 'research', '[{"name":"Lisa Park","role":"CEO","email":"lisa@innovlabs.com"}]', 'active', 1],
    ['CloudScale Inc', 'company', 'sales@cloudscale.com', '+1-555-0104', '321 Cloud Ave, Redmond, WA 98052', 'Washington, USA', 'US-CS-901234', 'technology', '[{"name":"Tom Wright","role":"Account Manager","email":"tom@cloudscale.com"}]', 'active', 1],
    ['Pinnacle Properties', 'company', 'leasing@pinnacle.com', '+1-555-0105', '555 Real Estate Pl, New York, NY 10001', 'New York, USA', 'US-PP-567890', 'real_estate', '[{"name":"Jennifer Adams","role":"Leasing Director","email":"jen@pinnacle.com"}]', 'active', 1],
    ['GlobalParts Co', 'company', 'orders@globalparts.com', '+1-555-0106', '900 Manufacturing Way, Chicago, IL 60601', 'Illinois, USA', 'US-GP-123789', 'manufacturing', '[{"name":"Robert Kim","role":"Sales VP","email":"robert@globalparts.com"}]', 'active', 1],
    ['BrandSpark Agency', 'company', 'hello@brandspark.com', '+1-555-0107', '222 Creative St, Los Angeles, CA 90001', 'California, USA', 'US-BS-456012', 'marketing', '[{"name":"Emily Zhang","role":"Account Director","email":"emily@brandspark.com"}]', 'active', 1],
    ['AsiaConnect Ltd', 'company', 'partnerships@asiaconnect.sg', '+65-6789-0108', '1 Raffles Place, Singapore 048616', 'Singapore', 'SG-AC-789345', 'consulting', '[{"name":"Wei Lin","role":"Managing Director","email":"wei@asiaconnect.sg"}]', 'active', 1],
    ['SecureData Corp', 'company', 'compliance@securedata.eu', '+49-30-555-0109', 'Friedrichstr 123, 10117 Berlin', 'Germany / EU', 'DE-SD-012678', 'technology', '[{"name":"Hans Mueller","role":"DPO","email":"hans@securedata.eu"}]', 'active', 1],
    ['McKinley Consulting', 'company', 'engagements@mckinley.com', '+1-555-0110', '100 Strategy Blvd, Boston, MA 02199', 'Massachusetts, USA', 'US-MC-345901', 'consulting', '[{"name":"David Chen","role":"Partner","email":"david@mckinley.com"}]', 'active', 1],
    ['Shield Insurance Group', 'company', 'policies@shield.com', '+1-555-0111', '500 Insurance Way, Hartford, CT 06101', 'Connecticut, USA', 'US-SI-678234', 'insurance', '[{"name":"Amanda Foster","role":"Underwriter","email":"amanda@shield.com"}]', 'active', 1],
    ['EcoVentures Corp', 'company', 'invest@ecoventures.com', '+1-555-0112', '750 Green Tech Dr, Denver, CO 80201', 'Colorado, USA', 'US-EV-901567', 'cleantech', '[{"name":"Carlos Rivera","role":"CEO","email":"carlos@ecoventures.com"}]', 'active', 1],
    ['PaymentPro Inc', 'company', 'partners@paymentpro.com', '+1-555-0113', '400 Fintech Ave, San Francisco, CA 94102', 'California, USA', 'US-PI-234890', 'fintech', '[{"name":"Priya Sharma","role":"Integration Lead","email":"priya@paymentpro.com"}]', 'active', 1],
    ['BuildRight Construction', 'company', 'projects@buildright.com', '+1-555-0114', '800 Builder Rd, Austin, TX 78701', 'Texas, USA', 'US-BR-567123', 'construction', '[{"name":"James Wilson","role":"Project Manager","email":"james@buildright.com"}]', 'active', 1],
    ['John Smith', 'individual', 'john.smith@email.com', '+1-555-0115', '42 Developer Lane, Brooklyn, NY 11201', 'New York, USA', 'SSN-XXX-XX-1234', 'technology', '[]', 'active', 1],
  ];
  for (const p of parties) {
    await pool.query('INSERT INTO parties (name,party_type,email,phone,address,jurisdiction,tax_id,industry,contacts,status,contracts_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', p);
  }

  // Obligations
  const obligations = [
    [1, 'Deliver monthly progress reports', 'Provide detailed monthly status reports on all active workstreams', 'TechCorp Solutions', 'reporting', '2024-02-01', 'monthly', 'completed', 'medium'],
    [1, 'Maintain data security standards', 'Comply with SOC 2 Type II security requirements', 'TechCorp Solutions', 'compliance', '2025-12-31', 'ongoing', 'active', 'high'],
    [2, 'Provide 99.9% uptime SLA', 'Maintain platform availability as per SLA terms', 'DataFlow Analytics', 'performance', '2025-03-14', 'ongoing', 'active', 'critical'],
    [5, 'Pay monthly hosting fees', 'Pay $8,000/month cloud infrastructure fees by the 1st', 'Acme Inc', 'payment', '2025-03-01', 'monthly', 'active', 'high'],
    [6, 'Maintain premises insurance', 'Carry minimum $5M liability insurance for leased space', 'Acme Inc', 'insurance', '2024-12-31', 'annual', 'completed', 'medium'],
    [7, 'Meet minimum order quantities', 'Purchase minimum 10,000 units per quarter', 'Acme Inc', 'purchase', '2024-09-01', 'quarterly', 'pending', 'high'],
    [7, 'Quality certification compliance', 'Maintain ISO 9001 certification for supplied parts', 'GlobalParts Co', 'compliance', '2025-05-31', 'ongoing', 'active', 'critical'],
    [9, 'Submit quarterly financial reports', 'Provide audited quarterly financials for JV operations', 'Both Parties', 'reporting', '2024-12-31', 'quarterly', 'pending', 'high'],
    [10, 'GDPR compliance audit', 'Complete annual GDPR compliance audit and provide results', 'SecureData Corp', 'compliance', '2025-02-28', 'annual', 'active', 'critical'],
    [11, 'Strategic review meetings', 'Attend monthly strategic review sessions', 'McKinley Consulting', 'performance', '2025-02-14', 'monthly', 'active', 'medium'],
    [3, 'Non-compete compliance', 'Refrain from competing work during employment and 12 months after', 'John Smith', 'restriction', '2026-01-31', 'ongoing', 'active', 'high'],
    [14, 'API uptime guarantee', 'Maintain 99.95% API availability', 'PaymentPro Inc', 'performance', '2025-04-30', 'ongoing', 'active', 'critical'],
    [15, 'Weekly construction updates', 'Provide weekly progress reports with photos', 'BuildRight Construction', 'reporting', '2025-02-15', 'weekly', 'pending', 'medium'],
    [8, 'Campaign performance reports', 'Deliver bi-weekly marketing performance analytics', 'BrandSpark Agency', 'reporting', '2025-06-30', 'bi-weekly', 'pending', 'medium'],
    [13, 'Environmental impact assessment', 'Complete initial environmental impact study', 'EcoVentures Corp', 'deliverable', '2025-01-15', 'one-time', 'overdue', 'high'],
  ];
  for (const o of obligations) {
    await pool.query('INSERT INTO obligations (contract_id,title,description,obligated_party,obligation_type,due_date,frequency,status,priority) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', o);
  }

  // Approvals
  const approvals = [
    [7, 'Jane Wilson', 'jane.wilson@acme.com', 'legal_review', 'approved', 'Terms are acceptable with minor revisions needed in Section 4.2', '2024-05-20 14:30:00', 'normal'],
    [7, 'Mark Thompson', 'mark.thompson@acme.com', 'financial_review', 'approved', 'Budget approved. Value within procurement authority limits.', '2024-05-22 09:15:00', 'normal'],
    [7, 'CEO Office', 'ceo@acme.com', 'executive_approval', 'pending', null, null, 'high'],
    [8, 'Marketing VP', 'vp.marketing@acme.com', 'department_approval', 'approved', 'Approved. Agency has strong track record.', '2024-06-15 11:00:00', 'normal'],
    [8, 'Legal Team', 'legal@acme.com', 'legal_review', 'pending', null, null, 'normal'],
    [9, 'Board of Directors', 'board@acme.com', 'board_approval', 'pending', null, null, 'urgent'],
    [9, 'CFO', 'cfo@acme.com', 'financial_review', 'approved', 'Financial model approved. ROI projections acceptable.', '2024-08-10 16:45:00', 'high'],
    [9, 'General Counsel', 'gc@acme.com', 'legal_review', 'in_review', 'Reviewing international regulatory implications', null, 'high'],
    [13, 'Sustainability Officer', 'sustainability@acme.com', 'compliance_review', 'approved', 'Aligns with corporate ESG goals', '2024-09-05 10:30:00', 'normal'],
    [13, 'CFO', 'cfo@acme.com', 'financial_review', 'pending', null, null, 'high'],
    [15, 'Facilities Director', 'facilities@acme.com', 'department_approval', 'approved', 'Construction plan meets requirements', '2024-12-20 13:00:00', 'normal'],
    [15, 'CFO', 'cfo@acme.com', 'financial_review', 'pending', null, null, 'urgent'],
    [15, 'Legal Team', 'legal@acme.com', 'legal_review', 'in_review', 'Reviewing contractor insurance and bond requirements', null, 'high'],
    [4, 'Legal Team', 'legal@acme.com', 'legal_review', 'approved', 'Standard mutual NDA. Approved.', '2024-01-10 09:00:00', 'normal'],
    [10, 'DPO', 'dpo@acme.com', 'compliance_review', 'approved', 'GDPR compliance verified. Sub-processor list acceptable.', '2024-02-25 14:15:00', 'high'],
  ];
  for (const a of approvals) {
    await pool.query('INSERT INTO approvals (contract_id,approver_name,approver_email,approval_type,status,comments,decision_date,priority) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', a);
  }

  // Amendments
  const amendments = [
    [1, 'Rate Adjustment - Year 2', 'Increase hourly rate from $150 to $165 for Year 2', 'modification', '[{"field":"hourly_rate","old":"150","new":"165"},{"field":"annual_cap","old":"250000","new":"275000"}]', '2025-01-01', 'approved', 'TechCorp Solutions', 'Jane Wilson'],
    [2, 'Add Enterprise Module', 'Include enterprise analytics module in license scope', 'addition', '[{"field":"modules","added":"Enterprise Analytics"},{"field":"license_fee","old":"180000","new":"215000"}]', '2024-09-01', 'approved', 'Acme Inc', 'Mark Thompson'],
    [5, 'Upgrade to Premium Tier', 'Upgrade cloud infrastructure to premium support tier', 'modification', '[{"field":"support_tier","old":"standard","new":"premium"},{"field":"monthly_fee","old":"8000","new":"12000"}]', '2024-07-01', 'approved', 'Acme Inc', 'CTO'],
    [6, 'Extend Lease Term', 'Extend lease by 24 months with 3% annual increase', 'extension', '[{"field":"end_date","old":"2026-12-31","new":"2028-12-31"},{"field":"rent_increase","value":"3% annually"}]', '2026-10-01', 'draft', 'Pinnacle Properties', null],
    [1, 'Add Security Compliance', 'Add SOC 2 Type II compliance requirements', 'addition', '[{"field":"compliance","added":"SOC 2 Type II"},{"field":"audit_frequency","value":"annual"}]', '2024-06-01', 'approved', 'Acme Inc', 'CISO'],
    [7, 'Revise Payment Terms', 'Change payment terms from Net 30 to Net 45', 'modification', '[{"field":"payment_terms","old":"Net 30","new":"Net 45"}]', '2024-08-01', 'pending', 'GlobalParts Co', null],
    [9, 'Adjust Profit Split', 'Modify profit distribution from 50/50 to 60/40', 'modification', '[{"field":"profit_split","old":"50/50","new":"60/40 (Acme/AsiaConnect)"}]', '2025-01-01', 'negotiation', 'Acme Inc', null],
    [11, 'Scope Expansion', 'Add digital transformation consulting track', 'addition', '[{"field":"scope","added":"Digital Transformation"},{"field":"budget_increase","value":"100000"}]', '2024-08-01', 'approved', 'Acme Inc', 'COO'],
    [3, 'Salary Adjustment', 'Annual salary increase per performance review', 'modification', '[{"field":"base_salary","old":"145000","new":"160000"},{"field":"bonus_target","old":"15%","new":"20%"}]', '2025-02-01', 'approved', 'HR Director', 'CEO'],
    [14, 'Volume Discount Tier', 'Add volume-based pricing tiers for API calls', 'addition', '[{"field":"pricing_tiers","added":"volume_discount"},{"field":"threshold","value":"1M calls/month"}]', '2024-10-01', 'approved', 'PaymentPro Inc', 'VP Engineering'],
    [10, 'Add Sub-processor', 'Approve new sub-processor for data analytics', 'addition', '[{"field":"sub_processors","added":"AnalyticsCo GmbH"}]', '2024-11-01', 'approved', 'SecureData Corp', 'DPO'],
    [12, 'Coverage Increase', 'Increase D&O coverage limits', 'modification', '[{"field":"coverage_limit","old":"5000000","new":"10000000"},{"field":"premium_increase","value":"15000"}]', '2025-01-01', 'pending', 'Shield Insurance Group', null],
    [15, 'Change Order #1', 'Additional parking structure in construction scope', 'addition', '[{"field":"scope","added":"Parking Structure"},{"field":"cost_increase","value":"850000"}]', '2025-03-01', 'draft', 'BuildRight Construction', null],
    [4, 'Extend NDA Duration', 'Extend confidentiality period from 2 to 3 years', 'extension', '[{"field":"duration","old":"2 years","new":"3 years"}]', '2024-06-01', 'approved', 'Innovation Labs', 'General Counsel'],
    [8, 'Add Social Media Scope', 'Include TikTok and LinkedIn management', 'addition', '[{"field":"channels","added":"TikTok, LinkedIn"},{"field":"monthly_fee_increase","value":"3000"}]', '2024-10-01', 'approved', 'BrandSpark Agency', 'Marketing VP'],
  ];
  for (const a of amendments) {
    await pool.query('INSERT INTO amendments (contract_id,title,description,amendment_type,changes,effective_date,status,requested_by,approved_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', a);
  }

  // Renewals
  const renewals = [
    [1, 'auto', '2026-01-01', '2027-12-31', 275000, true, '2025-10-01', 'pending', 'Auto-renewal with updated rates per amendment'],
    [2, 'manual', '2025-03-15', '2026-03-14', 215000, false, '2025-01-15', 'pending', 'Renewal at same terms with enterprise module'],
    [3, 'manual', '2025-02-01', '2026-01-31', 160000, true, '2024-12-01', 'approved', 'Renewed with salary adjustment'],
    [4, 'auto', '2026-01-15', '2028-01-14', 0, false, '2025-11-15', 'pending', 'Auto-renewal per NDA terms'],
    [5, 'manual', '2025-04-01', '2026-03-31', 144000, true, '2025-02-01', 'pending', 'Renewal at premium tier pricing'],
    [10, 'manual', '2025-03-01', '2026-02-28', 52000, false, '2025-01-01', 'approved', 'GDPR DPA renewal with updated sub-processor list'],
    [11, 'manual', '2025-02-15', '2026-02-14', 500000, true, '2025-01-15', 'negotiation', 'Expanded scope with digital transformation'],
    [12, 'auto', '2025-01-01', '2025-12-31', 90000, true, '2024-11-01', 'approved', 'Renewed with increased coverage'],
    [14, 'auto', '2025-05-01', '2026-04-30', 42000, true, '2025-03-01', 'pending', 'Renewal with volume pricing tiers'],
    [6, 'negotiation', '2027-01-01', '2028-12-31', 385000, true, '2026-07-01', 'pending', 'Lease extension negotiation in progress'],
    [7, 'manual', '2025-06-01', '2026-05-31', 540000, false, '2025-04-01', 'pending', 'Renewal pending executive approval'],
    [8, 'manual', '2025-07-01', '2026-06-30', 186000, true, '2025-05-01', 'pending', 'Including new social media scope'],
    [9, 'manual', '2027-09-01', '2030-08-31', 1500000, true, '2027-06-01', 'pending', 'Multi-year renewal for APAC partnership'],
    [13, 'manual', '2029-10-01', '2034-09-30', 3000000, true, '2029-07-01', 'pending', 'JV renewal for Phase 2'],
    [15, 'manual', '2026-07-01', '2027-06-30', 200000, false, '2026-05-01', 'pending', 'Post-construction maintenance agreement'],
  ];
  for (const r of renewals) {
    await pool.query('INSERT INTO renewals (contract_id,renewal_type,new_start_date,new_end_date,new_value,terms_changed,notice_date,status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', r);
  }

  // Risk Assessments
  const risks = [
    [1, 'MSA Risk Assessment - TechCorp', 25, 'low', 15, 30, 20, 25, '[{"factor":"Well-established vendor","impact":"positive"},{"factor":"Clear SLA terms","impact":"positive"}]', '[{"step":"Annual review"},{"step":"Monitor SLA compliance"}]', 'Legal Team', 'completed'],
    [7, 'Supply Agreement Risk - GlobalParts', 72, 'high', 80, 65, 75, 70, '[{"factor":"Single source dependency","impact":"critical"},{"factor":"International supply chain","impact":"high"}]', '[{"step":"Identify backup supplier"},{"step":"Increase safety stock"},{"step":"Add penalty clauses"}]', 'Risk Committee', 'completed'],
    [9, 'APAC Partnership Risk Assessment', 78, 'high', 70, 85, 75, 80, '[{"factor":"Foreign jurisdiction","impact":"high"},{"factor":"Currency risk","impact":"medium"},{"factor":"Regulatory complexity","impact":"high"}]', '[{"step":"Local legal counsel"},{"step":"Currency hedging"},{"step":"Quarterly compliance reviews"}]', 'Board Risk Committee', 'completed'],
    [15, 'Construction Risk Assessment', 65, 'high', 75, 55, 70, 60, '[{"factor":"Large capital expenditure","impact":"high"},{"factor":"Timeline risk","impact":"medium"},{"factor":"Contractor dependency","impact":"medium"}]', '[{"step":"Performance bond required"},{"step":"Milestone-based payments"},{"step":"Weekly inspections"}]', 'Project Manager', 'completed'],
    [10, 'DPA Risk Assessment - GDPR', 55, 'medium', 40, 70, 45, 65, '[{"factor":"Cross-border data transfer","impact":"high"},{"factor":"Sub-processor chain","impact":"medium"}]', '[{"step":"Annual GDPR audit"},{"step":"Data flow mapping"},{"step":"Breach response plan"}]', 'DPO', 'completed'],
    [6, 'Lease Risk Assessment', 35, 'low', 40, 30, 35, 30, '[{"factor":"Long-term commitment","impact":"medium"},{"factor":"Market rate lock-in","impact":"low"}]', '[{"step":"Early termination clause"},{"step":"Subletting rights"}]', 'Facilities Manager', 'completed'],
    [13, 'JV Risk Assessment - GreenTech', 82, 'critical', 85, 80, 78, 85, '[{"factor":"High capital commitment","impact":"critical"},{"factor":"Technology risk","impact":"high"},{"factor":"Regulatory uncertainty","impact":"high"}]', '[{"step":"Phased investment"},{"step":"IP protection"},{"step":"Exit provisions"},{"step":"Insurance coverage"}]', 'Board Risk Committee', 'completed'],
    [2, 'Software License Risk', 30, 'low', 25, 35, 30, 30, '[{"factor":"Vendor stability","impact":"low"},{"factor":"Data portability","impact":"medium"}]', '[{"step":"Data export capability"},{"step":"Vendor financial review"}]', 'IT Director', 'completed'],
    [5, 'Cloud Infrastructure Risk', 45, 'medium', 35, 50, 55, 40, '[{"factor":"Vendor lock-in potential","impact":"medium"},{"factor":"Data sovereignty","impact":"medium"}]', '[{"step":"Multi-cloud strategy"},{"step":"Regular backups"},{"step":"DR testing"}]', 'CTO', 'completed'],
    [11, 'Consulting Engagement Risk', 40, 'medium', 50, 35, 40, 35, '[{"factor":"Cost overrun potential","impact":"medium"},{"factor":"Deliverable quality","impact":"medium"}]', '[{"step":"Fixed milestone payments"},{"step":"Quality gates"}]', 'Project Sponsor', 'completed'],
    [4, 'NDA Risk Assessment', 15, 'low', 10, 20, 10, 15, '[{"factor":"Standard mutual NDA","impact":"low"},{"factor":"Limited scope","impact":"positive"}]', '[{"step":"Annual review"}]', 'Legal Team', 'completed'],
    [8, 'Marketing Agency Risk', 35, 'low', 40, 25, 35, 35, '[{"factor":"Brand reputation risk","impact":"medium"},{"factor":"Performance measurement","impact":"low"}]', '[{"step":"KPI-based performance"},{"step":"Monthly reviews"}]', 'Marketing VP', 'completed'],
    [3, 'Employment Risk - Sr Developer', 20, 'low', 15, 25, 20, 15, '[{"factor":"Standard employment terms","impact":"low"},{"factor":"Non-compete enforceability","impact":"medium"}]', '[{"step":"IP assignment verification"},{"step":"Exit interview process"}]', 'HR Director', 'completed'],
    [14, 'API Integration Risk', 42, 'medium', 35, 50, 45, 40, '[{"factor":"Service dependency","impact":"medium"},{"factor":"PCI compliance","impact":"high"}]', '[{"step":"Redundancy planning"},{"step":"PCI audit"},{"step":"Rate limiting"}]', 'VP Engineering', 'completed'],
    [12, 'Insurance Coverage Risk', 20, 'low', 25, 15, 20, 15, '[{"factor":"Coverage adequacy","impact":"medium"},{"factor":"Premium cost","impact":"low"}]', '[{"step":"Annual coverage review"},{"step":"Market comparison"}]', 'CFO', 'completed'],
  ];
  for (const r of risks) {
    await pool.query('INSERT INTO risk_assessments (contract_id,title,overall_score,risk_level,financial_risk,legal_risk,operational_risk,compliance_risk,risk_factors,mitigation_steps,assessor,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', r);
  }

  // Compliance Checks
  const compliance = [
    [10, 'GDPR Compliance Review', 'GDPR', 92, 'passed', '[{"finding":"All data processing activities documented","severity":"info"},{"finding":"Privacy impact assessment current","severity":"info"}]', '["GDPR Art. 28","GDPR Art. 32","GDPR Art. 33"]', 'DPO', '2025-03-01'],
    [1, 'SOC 2 Type II Compliance', 'SOC 2', 88, 'passed', '[{"finding":"Access controls verified","severity":"info"},{"finding":"Encryption at rest confirmed","severity":"info"}]', '["SOC 2 CC6.1","SOC 2 CC6.6","SOC 2 CC7.2"]', 'Security Team', '2025-06-01'],
    [7, 'Trade Compliance Review', 'Export Control', 75, 'conditional', '[{"finding":"Some parts require export license","severity":"medium"},{"finding":"End-user certification needed","severity":"high"}]', '["EAR","ITAR"]', 'Trade Compliance Officer', '2025-01-15'],
    [9, 'International Sanctions Check', 'OFAC', 100, 'passed', '[{"finding":"All parties cleared against sanctions lists","severity":"info"}]', '["OFAC SDN List","EU Sanctions","UN Sanctions"]', 'Compliance Team', '2025-06-01'],
    [3, 'Employment Law Compliance', 'Labor Law', 95, 'passed', '[{"finding":"All required provisions present","severity":"info"},{"finding":"Non-compete within enforceable limits","severity":"info"}]', '["FLSA","NY Labor Law","ADA"]', 'HR Legal', '2025-02-01'],
    [6, 'Building Code Compliance', 'Building Codes', 90, 'passed', '[{"finding":"ADA compliance verified","severity":"info"},{"finding":"Fire safety requirements met","severity":"info"}]', '["ADA","OSHA","NYC Building Code"]', 'Facilities Manager', '2025-01-01'],
    [15, 'Construction Permit Compliance', 'Construction Regs', 85, 'conditional', '[{"finding":"Environmental permit pending","severity":"high"},{"finding":"Building permit approved","severity":"info"}]', '["OSHA","EPA","TX Building Code"]', 'Project Manager', '2025-04-01'],
    [14, 'PCI DSS Compliance', 'PCI DSS', 82, 'conditional', '[{"finding":"Tokenization implemented","severity":"info"},{"finding":"Penetration test recommended","severity":"medium"}]', '["PCI DSS 3.2.1","PCI DSS 4.0"]', 'Security Team', '2025-05-01'],
    [2, 'Software License Audit', 'License Compliance', 100, 'passed', '[{"finding":"All licenses properly documented","severity":"info"}]', '["BSA Guidelines","Software License Terms"]', 'IT Compliance', '2025-03-14'],
    [12, 'Insurance Regulatory Check', 'Insurance Regs', 98, 'passed', '[{"finding":"Coverage meets statutory requirements","severity":"info"}]', '["State Insurance Regulations","SEC Requirements"]', 'Legal Team', '2025-01-01'],
    [13, 'Environmental Compliance', 'EPA', 70, 'in_progress', '[{"finding":"EIA required before operations begin","severity":"critical"},{"finding":"Emissions monitoring plan needed","severity":"high"}]', '["Clean Air Act","NEPA","State Environmental Laws"]', 'Environmental Consultant', '2025-06-01'],
    [5, 'Cloud Security Compliance', 'ISO 27001', 90, 'passed', '[{"finding":"Vendor ISO 27001 certified","severity":"info"},{"finding":"Data center compliance verified","severity":"info"}]', '["ISO 27001","CSA STAR","SOC 2"]', 'CISO', '2025-04-01'],
    [11, 'Anti-Corruption Check', 'FCPA', 95, 'passed', '[{"finding":"No red flags identified","severity":"info"},{"finding":"Due diligence completed","severity":"info"}]', '["FCPA","UK Bribery Act"]', 'Compliance Officer', '2025-02-15'],
    [4, 'IP Protection Review', 'Trade Secret Law', 88, 'passed', '[{"finding":"NDA terms adequately protect trade secrets","severity":"info"}]', '["DTSA","State Trade Secret Laws"]', 'IP Counsel', '2026-01-15'],
    [8, 'Advertising Compliance', 'FTC', 85, 'passed', '[{"finding":"Disclosure requirements met","severity":"info"},{"finding":"Social media guidelines compliant","severity":"info"}]', '["FTC Act","CAN-SPAM","TCPA"]', 'Marketing Compliance', '2025-06-30'],
  ];
  for (const c of compliance) {
    await pool.query('INSERT INTO compliance_checks (contract_id,title,regulation,compliance_score,status,findings,regulations,checked_by,next_review) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', c);
  }

  // Milestones
  const milestones = [
    [1, 'Project Kickoff', 'Initial project setup and onboarding', 'kickoff', '2024-01-15', '2024-01-15', 'completed', 25000, 'TechCorp Solutions'],
    [1, 'Phase 1 Delivery', 'Core platform development complete', 'deliverable', '2024-06-30', '2024-07-05', 'completed', 75000, 'TechCorp Solutions'],
    [1, 'Phase 2 Delivery', 'Advanced features and integrations', 'deliverable', '2024-12-31', null, 'in_progress', 100000, 'TechCorp Solutions'],
    [7, 'Initial Shipment', 'First bulk order delivery of 50,000 units', 'delivery', '2024-07-15', '2024-07-20', 'completed', 130000, 'GlobalParts Co'],
    [7, 'Quality Audit', 'On-site quality inspection at manufacturer', 'audit', '2024-09-01', null, 'pending', 0, 'Acme Inc'],
    [9, 'Market Research Complete', 'APAC market analysis and entry strategy', 'deliverable', '2024-11-30', '2024-11-28', 'completed', 100000, 'AsiaConnect Ltd'],
    [9, 'Singapore Office Setup', 'Establish regional headquarters', 'milestone', '2025-03-31', null, 'in_progress', 200000, 'Both Parties'],
    [9, 'First Revenue Target', 'Achieve $500K in APAC revenue', 'financial', '2025-09-30', null, 'pending', 0, 'JV Entity'],
    [15, 'Foundation Complete', 'Building foundation and structural work', 'construction', '2025-06-30', null, 'pending', 960000, 'BuildRight Construction'],
    [15, 'Structural Completion', 'Steel and concrete structure finished', 'construction', '2025-12-31', null, 'pending', 1200000, 'BuildRight Construction'],
    [15, 'Interior Fit-out', 'Interior construction and finishing', 'construction', '2026-03-31', null, 'pending', 1440000, 'BuildRight Construction'],
    [15, 'Final Inspection', 'Certificate of occupancy obtained', 'inspection', '2026-06-30', null, 'pending', 1200000, 'BuildRight Construction'],
    [13, 'Technology Prototype', 'Working prototype of clean energy system', 'deliverable', '2025-06-30', null, 'pending', 500000, 'EcoVentures Corp'],
    [11, 'Strategy Report', 'Final strategic recommendations report', 'deliverable', '2025-01-31', null, 'in_progress', 150000, 'McKinley Consulting'],
    [8, 'Campaign Launch', 'Initial digital marketing campaign live', 'launch', '2024-08-15', '2024-08-15', 'completed', 30000, 'BrandSpark Agency'],
  ];
  for (const m of milestones) {
    await pool.query('INSERT INTO milestones (contract_id,title,description,milestone_type,due_date,completed_date,status,payment_amount,responsible_party) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', m);
  }

  // Documents
  const documents = [
    [1, 'MSA - TechCorp (Executed)', 'contract', 'MSA_TechCorp_Executed_2024.pdf', '2.4MB', '2.0', 'Legal Team', '{"pages":45,"signed":true,"notarized":false}', 'active'],
    [1, 'SOW #1 - Platform Development', 'sow', 'SOW1_Platform_Dev.pdf', '1.8MB', '1.0', 'Project Manager', '{"pages":12,"signed":true}', 'active'],
    [2, 'Software License Certificate', 'license', 'DataFlow_License_2024.pdf', '890KB', '1.0', 'IT Director', '{"license_key":"DF-ENT-2024-XXXXX"}', 'active'],
    [4, 'Mutual NDA - Innovation Labs', 'nda', 'NDA_InnovationLabs_2024.pdf', '1.1MB', '1.0', 'Legal Team', '{"pages":8,"mutual":true}', 'active'],
    [6, 'Commercial Lease - Signed', 'lease', 'Lease_Pinnacle_2024.pdf', '3.5MB', '1.0', 'Facilities', '{"pages":62,"recorded":true}', 'active'],
    [7, 'Supply Agreement - Draft v3', 'contract', 'Supply_GlobalParts_v3.docx', '1.2MB', '3.0', 'Procurement', '{"pages":28,"tracked_changes":true}', 'draft'],
    [7, 'Quality Standards Appendix', 'appendix', 'QualityStandards_Appendix.pdf', '4.2MB', '1.0', 'Quality Team', '{"pages":35,"iso_reference":"ISO 9001"}', 'active'],
    [9, 'Partnership Term Sheet', 'term_sheet', 'TermSheet_APAC_v2.pdf', '650KB', '2.0', 'Business Dev', '{"pages":6,"non_binding":true}', 'active'],
    [10, 'GDPR Impact Assessment', 'compliance', 'DPIA_SecureData_2024.pdf', '2.8MB', '1.0', 'DPO', '{"pages":22,"regulation":"GDPR"}', 'active'],
    [12, 'D&O Insurance Policy', 'insurance', 'DO_Policy_Shield_2024.pdf', '5.1MB', '1.0', 'CFO Office', '{"pages":48,"policy_number":"SIG-DO-2024-001"}', 'active'],
    [13, 'JV Business Plan', 'business_plan', 'JV_BusinessPlan_GreenTech.pdf', '3.9MB', '1.0', 'Strategy Team', '{"pages":55,"confidential":true}', 'active'],
    [15, 'Construction Blueprints', 'blueprint', 'NewOffice_Blueprints_v1.pdf', '15.2MB', '1.0', 'Architecture Firm', '{"pages":85,"scale":"1:100"}', 'active'],
    [15, 'Construction Timeline', 'schedule', 'Construction_Gantt_2025.pdf', '1.5MB', '1.0', 'Project Manager', '{"pages":8,"milestones":12}', 'active'],
    [3, 'Employment Contract - J.Smith', 'contract', 'Employment_JSmith_2024.pdf', '1.3MB', '1.0', 'HR Department', '{"pages":15,"signed":true}', 'active'],
    [11, 'Consulting Proposal', 'proposal', 'McKinley_Proposal_2024.pdf', '2.1MB', '1.0', 'McKinley Consulting', '{"pages":18,"approved":true}', 'active'],
  ];
  for (const d of documents) {
    await pool.query('INSERT INTO documents (contract_id,title,document_type,file_name,file_size,version,uploaded_by,metadata,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', d);
  }

  // Audit Log
  const audit = [
    [1, 'contract_created', 'contract', 1, 'admin@contractai.com', '192.168.1.100', '{"title":"MSA - TechCorp"}'],
    [1, 'contract_approved', 'contract', 1, 'jane.wilson@acme.com', '192.168.1.101', '{"approval_type":"legal_review"}'],
    [1, 'amendment_created', 'amendment', 1, 'admin@contractai.com', '192.168.1.100', '{"title":"Rate Adjustment - Year 2"}'],
    [7, 'contract_created', 'contract', 7, 'admin@contractai.com', '192.168.1.100', '{"title":"Vendor Supply Agreement"}'],
    [7, 'risk_assessment', 'risk', 2, 'risk.committee@acme.com', '192.168.1.102', '{"risk_level":"high","score":72}'],
    [9, 'contract_created', 'contract', 9, 'admin@contractai.com', '192.168.1.100', '{"title":"Partnership Agreement - APAC"}'],
    [9, 'approval_requested', 'approval', 6, 'admin@contractai.com', '192.168.1.100', '{"approver":"Board of Directors"}'],
    [10, 'compliance_check', 'compliance', 1, 'dpo@acme.com', '192.168.1.103', '{"regulation":"GDPR","score":92}'],
    [15, 'contract_created', 'contract', 15, 'admin@contractai.com', '192.168.1.100', '{"title":"Construction Contract"}'],
    [15, 'document_uploaded', 'document', 12, 'architecture@acme.com', '192.168.1.104', '{"file":"NewOffice_Blueprints_v1.pdf"}'],
    [2, 'amendment_approved', 'amendment', 2, 'mark.thompson@acme.com', '192.168.1.101', '{"title":"Add Enterprise Module"}'],
    [13, 'contract_drafted', 'contract', 13, 'admin@contractai.com', '192.168.1.100', '{"title":"JV Agreement - GreenTech"}'],
    [6, 'renewal_initiated', 'renewal', 10, 'facilities@acme.com', '192.168.1.105', '{"type":"negotiation"}'],
    [3, 'contract_executed', 'contract', 3, 'hr@acme.com', '192.168.1.106', '{"title":"Employment Contract - Sr Developer"}'],
    [4, 'compliance_passed', 'compliance', 14, 'ip.counsel@acme.com', '192.168.1.107', '{"regulation":"Trade Secret Law"}'],
  ];
  for (const a of audit) {
    await pool.query('INSERT INTO audit_log (contract_id,action,entity_type,entity_id,performed_by,ip_address,details) VALUES ($1,$2,$3,$4,$5,$6,$7)', a);
  }

  // Settings
  const settings = [
    ['default_jurisdiction', 'Delaware, USA', 'contracts', 'Default jurisdiction for new contracts'],
    ['auto_renewal_notice_days', '90', 'renewals', 'Days before expiry to send renewal notice'],
    ['approval_required_above', '100000', 'approvals', 'Contract value threshold requiring executive approval'],
    ['risk_assessment_required', 'true', 'risk', 'Require risk assessment for all new contracts'],
    ['compliance_check_interval', '90', 'compliance', 'Days between compliance reviews'],
    ['document_retention_years', '7', 'documents', 'Years to retain contract documents'],
    ['max_amendment_rounds', '5', 'amendments', 'Maximum amendment rounds before re-negotiation'],
    ['currency_default', 'USD', 'contracts', 'Default currency for contract values'],
    ['notification_email', 'contracts@acme.com', 'notifications', 'Email for contract lifecycle notifications'],
    ['audit_log_retention', '365', 'audit', 'Days to retain audit log entries'],
    ['ai_model', 'anthropic/claude-haiku-4.5', 'ai', 'AI model for contract analysis'],
    ['ai_review_auto', 'false', 'ai', 'Auto-run AI review on new contracts'],
    ['signature_method', 'digital', 'contracts', 'Default signature method (digital/wet)'],
    ['template_approval_required', 'true', 'templates', 'Require legal approval for template changes'],
    ['milestone_payment_auto', 'false', 'milestones', 'Auto-trigger payments on milestone completion'],
  ];
  for (const s of settings) {
    await pool.query('INSERT INTO settings (key,value,category,description) VALUES ($1,$2,$3,$4)', s);
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
