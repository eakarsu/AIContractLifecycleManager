'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const w=require('../services/contractLifecycle');const {validateRuntime}=require('../config/runtime');
test('immutable versions require URI and digest',()=>assert.throws(()=>w.validateDocument({objectUri:'file:///tmp/a',sha256:'a'.repeat(64),versionNumber:1}),/HTTPS/));
test('signature is gated on latest-version legal and business review',()=>{const v={id:'v2'};const approvals=[{gate:'legal',decision:'approved',document_version_id:'v2'},{gate:'business',decision:'approved',document_version_id:'v2'}];assert.equal(w.canRequestSignature(v,approvals,[{human_status:'corrected'}]),true);assert.throws(()=>w.canRequestSignature(v,approvals.slice(0,1),[]),/business/);});
test('privileged matters require counsel',()=>assert.throws(()=>w.canAccessMatter({role:'business_owner'},{privilege_level:'privileged'}),/counsel/));
test('runtime rejects wildcard production CORS',()=>assert.throws(()=>validateRuntime({DATABASE_URL:'x',JWT_SECRET:'x'.repeat(32),NODE_ENV:'production',CORS_ORIGINS:'*'}),/explicit/));
