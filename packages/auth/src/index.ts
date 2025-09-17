// Configuration
export { configureAuth, getAuthConfig } from './config';
export type { AuthConfig } from './config';

// Hooks
export { useCurrentUser } from './hooks/useCurrentUser';
export { useAuthStatus } from './hooks/useAuthStatus';
export type { CurrentUser } from './hooks/useCurrentUser';
export type { AuthStatus } from './hooks/useAuthStatus';

// Components
export { AuthGuard } from './components/AuthGuard';
export { RoleGuard } from './components/RoleGuard';
export type { UserRole } from './components/RoleGuard';

// Utils
export { TokenManager, tokenManager } from './utils/tokenManager';
export type { TokenInfo } from './utils/tokenManager';

// Re-export Amplify auth functions for convenience
export {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  updatePassword,
  getCurrentUser,
  fetchUserAttributes,
  updateUserAttributes,
  fetchAuthSession,
} from 'aws-amplify/auth';
