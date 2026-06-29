const rolePermissions = {
  admin: [
    'records:read',
    'records:write',
    'records:delete',
    'ai:run',
    'ops:read',
    'ops:execute',
    'settings:write',
  ],
  legal: [
    'records:read',
    'records:write',
    'ai:run',
    'ops:read',
  ],
  finance: [
    'records:read',
    'records:write',
    'ai:run',
    'ops:read',
  ],
  viewer: [
    'records:read',
    'ops:read',
  ],
};

function permissionsForRole(role) {
  return rolePermissions[role] || rolePermissions.viewer;
}

function requirePermission(permission) {
  return (req, res, next) => {
    const permissions = permissionsForRole(req.user?.role);
    if (!permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Permission denied',
        required_permission: permission,
        role: req.user?.role || 'unknown',
      });
    }
    next();
  };
}

module.exports = {
  rolePermissions,
  permissionsForRole,
  requirePermission,
};
