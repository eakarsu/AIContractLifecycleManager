const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'routes/ops.js',
  'routes/systemChat.js',
  'routes/documents.js',
  'middleware/auth.js',
  'middleware/permissions.js',
  'services/aiHelper.js',
];

for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, '..', file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${file}`);
  }
  require(fullPath);
}

const { rolePermissions, permissionsForRole } = require('../middleware/permissions');

if (!rolePermissions.admin.includes('ops:execute')) {
  throw new Error('Admin role must include ops:execute');
}

if (permissionsForRole('viewer').includes('records:delete')) {
  throw new Error('Viewer role must not include destructive permissions');
}

console.log('Smoke checks passed');
