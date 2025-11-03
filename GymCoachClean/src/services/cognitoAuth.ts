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
  static async signIn(email: string, password: string): Promise<AuthUser> {
    try {
      console.log('CognitoAuthService: Starting sign in for:', email);

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
      });

      if (response.AuthenticationResult) {
        const {AccessToken, RefreshToken, IdToken} =
          response.AuthenticationResult;

        if (!AccessToken || !RefreshToken || !IdToken) {
          throw new Error('Missing tokens in authentication result');
        }

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
      console.log('CognitoAuthService: Starting sign up for:', email);

      const command = new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: attributes
          ? Object.entries(attributes).map(([key, value]) => ({
              Name: key,
              Value: value,
            }))
          : undefined,
      });

      const response = await cognitoClient.send(command);
      console.log('CognitoAuthService: Sign up successful:', {
        userSub: response.UserSub,
        codeDeliveryDetails: response.CodeDeliveryDetails,
      });
    } catch (error: any) {
      console.error('CognitoAuthService: Sign up error:', error);
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
      const accessToken = await AsyncStorage.getItem('accessToken');
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      const idToken = await AsyncStorage.getItem('idToken');

      if (!accessToken || !refreshToken || !idToken) {
        console.log('CognitoAuthService: No stored tokens found');
        return null;
      }

      // Verify token is still valid by getting user info
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await cognitoClient.send(command);
      console.log('CognitoAuthService: Current user retrieved:', {
        username: response.Username,
        attributes: response.UserAttributes?.length,
      });

      const emailAttribute = response.UserAttributes?.find(
        attr => attr.Name === 'email',
      );

      return {
        username: response.Username || '',
        email: emailAttribute?.Value || '',
        accessToken,
        refreshToken,
        idToken,
      };
    } catch (error: any) {
      console.error('CognitoAuthService: Get current user error:', error);
      // Clear invalid tokens
      await this.signOut();
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
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      const username = await AsyncStorage.getItem('username');

      if (!refreshToken || !username) {
        console.log('CognitoAuthService: No refresh token or username found');
        return null;
      }

      console.log('CognitoAuthService: Refreshing tokens...');

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
      // Clear invalid tokens
      await this.signOut();
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
