import type { User } from '../types';

const BYPASS_ENABLED = import.meta.env.MODE === 'test' || import.meta.env.VITE_ENABLE_TEST_AUTH_BYPASS === 'true';
const BYPASS_SECRET =
  import.meta.env.VITE_TEST_AUTH_BYPASS_SECRET ||
  (import.meta.env.MODE === 'test' ? 'local-test-auth-bypass' : '');
const BYPASS_EMAIL = import.meta.env.VITE_TEST_AUTH_BYPASS_EMAIL || 'test-runner@geochallenge.local';
const BYPASS_USERNAME = import.meta.env.VITE_TEST_AUTH_BYPASS_USERNAME || 'TestRunner';

const isBypassConfigured = Boolean(BYPASS_SECRET && BYPASS_SECRET.trim().length > 0);

export const testAuthBypass = {
  isEnabled: BYPASS_ENABLED,
  isConfigured: isBypassConfigured,
  email: BYPASS_EMAIL,
  username: BYPASS_USERNAME,
  secret: BYPASS_SECRET,
};

export const buildTestBypassUser = (): User => ({
  id: 'test-auth-bypass-user',
  username: testAuthBypass.username,
  email: testAuthBypass.email,
  preferredLanguage: 'es',
  highScore: 0,
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
});
