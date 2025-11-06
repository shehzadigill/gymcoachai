import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  GlobalSignOutCommand,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration matching the web app
const REGION = 'eu-west-1';
const USER_POOL_ID = 'eu-west-1_PjxjqOwho';
const CLIENT_ID = '2pigu1tu2it4aablmg1cgis1eo';

// Create Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: REGION,
});

export interface AuthUser {
  username: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

export class CognitoAuthService {
  // Mutex to prevent concurrent refresh attempts
  private static refreshPromise: Promise<AuthUser | null> | null = null;

  static async signIn(email: string, password: string): Promise<AuthUser> {
    try {
      console.log('CognitoAuthService: Starting sign in for:', email);

      // Clear any old tokens first to prevent confusion
      await AsyncStorage.multiRemove([
        'accessToken',
        'refreshToken',
        'idToken',
        'username',
        'userEmail',
      ]);
      console.log('CognitoAuthService: Cleared old tokens before login');

      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      console.log('CognitoAuthService: Sending InitiateAuth command...');
      const response = await cognitoClient.send(command);
      console.log('CognitoAuthService: InitiateAuth response:', {
        challengeName: response.ChallengeName,
        hasAuthResult: !!response.AuthenticationResult,
        hasRefreshToken: !!response.AuthenticationResult?.RefreshToken,
      });

      if (response.AuthenticationResult) {
        const {AccessToken, RefreshToken, IdToken} =
          response.AuthenticationResult;

        if (!AccessToken || !RefreshToken || !IdToken) {
          throw new Error('Missing tokens in authentication result');
        }

        console.log('CognitoAuthService: Received tokens:', {
          accessTokenLength: AccessToken.length,
          refreshTokenLength: RefreshToken.length,
          idTokenLength: IdToken.length,
          refreshTokenPreview: RefreshToken.substring(0, 20) + '...',
        });

        // Store tokens and user info
        await AsyncStorage.setItem('accessToken', AccessToken);
        await AsyncStorage.setItem('refreshToken', RefreshToken);
        await AsyncStorage.setItem('idToken', IdToken);
        await AsyncStorage.setItem('username', email);
        await AsyncStorage.setItem('userEmail', email);

        console.log(
          'CognitoAuthService: Tokens and user info stored successfully',
        );

        return {
          username: email,
          email: email,
          accessToken: AccessToken,
          refreshToken: RefreshToken,
          idToken: IdToken,
        };
      } else {
        throw new Error('Authentication failed - no tokens received');
      }
    } catch (error: any) {
      console.error('CognitoAuthService: Sign in error:', {
        error,
        message: error.message,
        name: error.name,
        code: error.$metadata?.httpStatusCode,
      });
      throw error;
    }
  }

  static async signUp(
    email: string,
    password: string,
    attributes?: Record<string, string>,
  ): Promise<void> {
    try {
      const command = new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: attributes
          ? Object.entries(attributes).map(([Name, Value]) => ({
              Name,
              Value,
            }))
          : undefined,
      });

      await cognitoClient.send(command);
    } catch (error: any) {
      console.error('Sign up error:', error.message || error);
      throw error;
    }
  }

  static async confirmSignUp(email: string, code: string): Promise<void> {
    try {
      console.log('CognitoAuthService: Confirming sign up for:', email);

      const command = new ConfirmSignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
      });

      await cognitoClient.send(command);
      console.log('CognitoAuthService: Sign up confirmed successfully');
    } catch (error: any) {
      console.error('CognitoAuthService: Confirm sign up error:', error);
      throw error;
    }
  }

  static async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const username = await AsyncStorage.getItem('username');
      const email = await AsyncStorage.getItem('userEmail');
      const accessToken = await AsyncStorage.getItem('accessToken');
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      const idToken = await AsyncStorage.getItem('idToken');

      if (username && email && accessToken && refreshToken && idToken) {
        return {
          username,
          email,
          accessToken,
          refreshToken,
          idToken,
        };
      }

      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  static async signOut(): Promise<void> {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');

      if (accessToken) {
        const command = new GlobalSignOutCommand({
          AccessToken: accessToken,
        });

        await cognitoClient.send(command);
        console.log('CognitoAuthService: Global sign out successful');
      }
    } catch (error: any) {
      console.error('CognitoAuthService: Sign out error:', error);
      // Continue with local cleanup even if remote sign out fails
    } finally {
      // Clear all stored tokens and user data
      await AsyncStorage.multiRemove([
        'accessToken',
        'refreshToken',
        'idToken',
        'username',
        'userEmail',
      ]);
      console.log('CognitoAuthService: Local tokens and user data cleared');
    }
  }

  static async refreshTokens(): Promise<AuthUser | null> {
    // If a refresh is already in progress, wait for it instead of starting another
    if (this.refreshPromise) {
      console.log(
        'CognitoAuthService: Refresh already in progress, waiting...',
      );
      return this.refreshPromise;
    }

    // Start new refresh and store the promise
    this.refreshPromise = this.performRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      // Clear the promise after completion (success or failure)
      this.refreshPromise = null;
    }
  }

  private static async performRefresh(): Promise<AuthUser | null> {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      const username = await AsyncStorage.getItem('username');

      if (!refreshToken || !username) {
        console.log('CognitoAuthService: No refresh token or username found');
        return null;
      }

      console.log('CognitoAuthService: Refreshing tokens...');
      console.log('CognitoAuthService: Using refresh token:', {
        username,
        refreshTokenPreview: refreshToken.substring(0, 20) + '...',
        refreshTokenLength: refreshToken.length,
      });

      const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const response = await cognitoClient.send(command);

      if (response.AuthenticationResult) {
        const {AccessToken, IdToken} = response.AuthenticationResult;

        if (!AccessToken || !IdToken) {
          throw new Error('Missing tokens in refresh response');
        }

        // Update stored tokens (refresh token stays the same)
        await AsyncStorage.setItem('accessToken', AccessToken);
        await AsyncStorage.setItem('idToken', IdToken);

        console.log('CognitoAuthService: Tokens refreshed successfully');

        // Get user email from stored data or token
        const email = (await AsyncStorage.getItem('userEmail')) || '';

        return {
          username,
          email,
          accessToken: AccessToken,
          refreshToken,
          idToken: IdToken,
        };
      } else {
        throw new Error('Token refresh failed - no tokens received');
      }
    } catch (error: any) {
      console.error('CognitoAuthService: Token refresh error:', error);

      // CRITICAL FIX: Only clear tokens if they're actually invalid
      // NOT if refresh failed due to rate limits or network issues
      // Check for specific error patterns that indicate truly invalid tokens
      const isInvalidToken =
        error.name === 'NotAuthorizedException' ||
        error.message?.includes('Invalid Refresh Token') ||
        error.message?.includes('Refresh Token has expired') ||
        error.message?.includes('Refresh token has been revoked');

      if (isInvalidToken) {
        console.warn(
          'CognitoAuthService: Refresh token is invalid or expired - clearing tokens',
        );
        await this.signOut();
      } else {
        console.warn(
          'CognitoAuthService: Token refresh failed but keeping existing tokens. Error:',
          error.name || error.message,
        );
        // Return current user data from storage to keep session alive
        const username = await AsyncStorage.getItem('username');
        const email = (await AsyncStorage.getItem('userEmail')) || '';
        const accessToken = await AsyncStorage.getItem('accessToken');
        const idToken = await AsyncStorage.getItem('idToken');
        const refreshToken = await AsyncStorage.getItem('refreshToken');

        if (accessToken && idToken && refreshToken && username) {
          return {
            username,
            email,
            accessToken,
            refreshToken,
            idToken,
          };
        }
      }
      return null;
    }
  }

  static async resendConfirmationCode(email: string): Promise<void> {
    try {
      console.log(
        'CognitoAuthService: Resending confirmation code for:',
        email,
      );

      const command = new ResendConfirmationCodeCommand({
        ClientId: CLIENT_ID,
        Username: email,
      });

      const response = await cognitoClient.send(command);
      console.log('CognitoAuthService: Confirmation code resent:', {
        codeDeliveryDetails: response.CodeDeliveryDetails,
      });
    } catch (error: any) {
      console.error(
        'CognitoAuthService: Resend confirmation code error:',
        error,
      );
      throw error;
    }
  }
}

export default CognitoAuthService;
