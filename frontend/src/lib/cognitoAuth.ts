if (typeof window !== 'undefined' && typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

// Cognito User Pool configuration from environment or hardcoded from cdk-outputs
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'ap-south-1_sYp8CvKjn';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '6ufn4tstvrk6718ujcsjun6lpe';

const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: CLIENT_ID,
});

export interface CognitoSignUpParams {
  email: string;
  password: string;
  regNo: string;
  year: string;
  role?: string;
}

export interface CognitoAuthResult {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  email: string;
}

/**
 * Sign up a new user with Cognito User Pool.
 * Sends custom attributes: reg_no, year, role.
 */
export function cognitoSignUp(params: CognitoSignUpParams): Promise<string> {
  return new Promise((resolve, reject) => {
    const attributeList = [
      new CognitoUserAttribute({ Name: 'email', Value: params.email.toLowerCase() }),
      new CognitoUserAttribute({ Name: 'custom:reg_no', Value: params.regNo.toUpperCase() }),
      new CognitoUserAttribute({ Name: 'custom:year', Value: params.year }),
      new CognitoUserAttribute({ Name: 'custom:role', Value: params.role || 'student' }),
    ];

    userPool.signUp(
      params.email.toLowerCase(),
      params.password,
      attributeList,
      [],
      (err, result) => {
        if (err) {
          reject(new Error(err.message || 'Sign up failed'));
          return;
        }
        resolve(result?.userSub || 'unknown');
      }
    );
  });
}

/**
 * Sign in an existing user with Cognito User Pool.
 * Returns JWT tokens on success.
 */
export function cognitoSignIn(email: string, password: string): Promise<CognitoAuthResult> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email.toLowerCase(),
      Pool: userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: email.toLowerCase(),
      Password: password,
    });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session: CognitoUserSession) => {
        resolve({
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
          email: email.toLowerCase(),
        });
      },
      onFailure: (err) => {
        reject(new Error(err.message || 'Authentication failed'));
      },
      newPasswordRequired: (_userAttributes) => {
        // For users that need to set a new password (admin-created users)
        reject(new Error('New password required. Please contact administrator.'));
      },
    });
  });
}

/**
 * Sign out the current user from Cognito.
 */
export function cognitoSignOut(): void {
  const currentUser = userPool.getCurrentUser();
  if (currentUser) {
    currentUser.signOut();
  }
}

/**
 * Get the current authenticated session (restores from local storage).
 * Returns null if no valid session exists.
 */
export function getCurrentSession(): Promise<CognitoAuthResult | null> {
  return new Promise((resolve) => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      resolve(null);
      return;
    }

    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }

      const email = session.getIdToken().payload?.email || '';
      resolve({
        idToken: session.getIdToken().getJwtToken(),
        accessToken: session.getAccessToken().getJwtToken(),
        refreshToken: session.getRefreshToken().getToken(),
        email,
      });
    });
  });
}

/**
 * Helper to check if an error is a Cognito configuration or client ID error
 * (e.g. "User pool client ... does not exist", ResourceNotFoundException, InvalidParameterException)
 */
export function isCognitoConfigError(err: any): boolean {
  const msg = typeof err === 'string' ? err : err?.message || String(err || '');
  return (
    msg.includes('does not exist') ||
    msg.includes('ResourceNotFoundException') ||
    msg.includes('InvalidParameterException') ||
    msg.includes('User pool client')
  );
}

/**
 * Get the current valid JWT ID token (for API authorization).
 * Returns null if not authenticated.
 */
export async function getIdToken(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.idToken || null;
}
