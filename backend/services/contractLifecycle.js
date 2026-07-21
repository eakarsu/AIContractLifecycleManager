'use strict';
const STATES={intake:['draft'],draft:['redline','approval'],redline:['draft','approval'],approval:['draft','signature_pending'],signature_pending:['approval','executed'],executed:['active'],active:['renewal_review','terminated','expired'],renewal_review:['active','expired','terminated'],expired:[],terminated:[]};
function assert(ok,message){if(!ok){const e=new Error(message);e.status=422;throw e;}}
function context(user,tenantId,roles){assert(user&&user.id,'authenticated actor required');assert(tenantId,'x-tenant-id is required');
  if(user.tenantId||user.tenant_id) assert((user.tenantId||user.tenant_id)===tenantId,'tenant mismatch');
  const role=user.role||'viewer';assert(roles.includes(role),'role not authorized');return {tenantId,actorId:String(user.id),role};}
function validateIntake(input){assert(/^[A-Za-z0-9._:-]{3,128}$/.test(input.idempotencyKey||''),'invalid idempotencyKey');assert(String(input.title||'').trim().length>=3,'title is required');assert(String(input.counterparty||'').trim().length>=2,'counterparty is required');assert(String(input.playbookVersion||'').trim(),'playbookVersion is required');return input;}
function validateDocument(input){assert(/^https:\/\/|^s3:\/\/|^gs:\/\//.test(input.objectUri||''),'objectUri must use HTTPS or object storage');assert(/^[a-f0-9]{64}$/i.test(input.sha256||''),'sha256 is invalid');assert(Number.isInteger(input.versionNumber)&&input.versionNumber>0,'versionNumber must be positive');return input;}
function validateFinding(input){assert(String(input.extractedText||'').trim(),'extractedText is required');assert(String(input.pageReference||'').trim(),'pageReference is required');assert(String(input.playbookRule||'').trim(),'playbookRule is required');assert(Number(input.confidence)>=0&&Number(input.confidence)<=1,'confidence must be between 0 and 1');return input;}
function transition(from,to){assert(STATES[from]&&STATES[from].includes(to),`invalid transition ${from} -> ${to}`);return to;}
function canRequestSignature(latestVersion,approvals,findings){assert(latestVersion,'document version is required');
  for(const gate of ['legal','business']) assert(approvals.some(a=>a.gate===gate&&a.decision==='approved'&&a.document_version_id===latestVersion.id),`${gate} approval on latest version is required`);
  assert(findings.every(f=>['accepted','corrected','rejected'].includes(f.human_status)),'all clause findings require human disposition');return true;}
function canAccessMatter(user,matter){assert(user&&matter,'matter context required'); if(matter.privilege_level==='privileged') assert(['counsel','admin'].includes(user.role),'privileged matter requires counsel');return true;}
module.exports={STATES,context,validateIntake,validateDocument,validateFinding,transition,canRequestSignature,canAccessMatter};
