/**
 * Configuration for World Mall application policies
 * All values can be overridden via environment variables
 */
export const POLICY = {
  // Guest user limits
  guestCharLimit: parseInt(process.env.GUEST_CHAR_LIMIT || '60'),
  guestDaily: parseInt(process.env.GUEST_DAILY || '3'),
  guestCooldownSec: parseInt(process.env.GUEST_COOLDOWN_SEC || '90'),
  
  // Verified user limits  
  verifiedCharLimit: parseInt(process.env.VERIFIED_CHAR_LIMIT || '240'),
  verifiedPerMin: parseInt(process.env.VERIFIED_PER_MIN || '5'),
  verifiedPerHour: parseInt(process.env.VERIFIED_PER_HOUR || '60'),
  verifiedPerDay: parseInt(process.env.VERIFIED_PER_DAY || '200'),
  
  // World ID configuration
  worldId: {
    appId: process.env.WORLD_ID_APP_ID || '',
    action: process.env.WORLD_ID_ACTION || 'world-mall/verify',
    apiBase: process.env.WORLD_ID_API_BASE || 'https://developer.worldcoin.org'
  },
  
  // Feature flags
  enablePermit2: process.env.ENABLE_PERMIT2 === '1',
  disableWorldId: process.env.DISABLE_WORLDID === '1'
};