'use strict';
function validateRuntime(env = process.env) {
  const errors=[]; if(!env.DATABASE_URL) errors.push('DATABASE_URL is required');
  if(!env.JWT_SECRET || env.JWT_SECRET.length<32) errors.push('JWT_SECRET must contain at least 32 characters');
  if(env.NODE_ENV==='production' && (!env.CORS_ORIGINS || env.CORS_ORIGINS.includes('*'))) errors.push('Production CORS_ORIGINS must be explicit');
  if(errors.length) throw new Error(`Invalid runtime configuration: ${errors.join('; ')}`); return true;
}
module.exports={validateRuntime};
