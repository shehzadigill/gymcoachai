import { Amplify } from 'aws-amplify';

export interface AuthConfig {
  userPoolId: string;
  userPoolClientId: string;
  userPoolDomain: string;
  region: string;
  cloudFrontUrl: string;
}

export const configureAuth = (config: AuthConfig) => {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
        loginWith: {
          oauth: {
            domain: config.userPoolDomain,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [
              'http://localhost:3000/auth/callback',
              `${config.cloudFrontUrl}/auth/callback`,
            ],
            redirectSignOut: [
              'http://localhost:3000/auth/logout',
              `${config.cloudFrontUrl}/auth/logout`,
            ],
            responseType: 'code',
          },
          email: true,
          username: true,
        },
      },
    },
    API: {
      REST: {
        GymCoachAPI: {
          endpoint: config.cloudFrontUrl,
          region: config.region,
        },
      },
    },
  });
};

export const getAuthConfig = (): AuthConfig => {
  const userPoolId = process.env.NEXT_PUBLIC_USER_POOL_ID || '';
  const userPoolClientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || '';
  const userPoolDomain = process.env.NEXT_PUBLIC_USER_POOL_DOMAIN || '';
  const region = process.env.NEXT_PUBLIC_AWS_REGION || 'eu-north-1';
  const cloudFrontUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_URL || '';

  if (!userPoolId || !userPoolClientId || !userPoolDomain || !cloudFrontUrl) {
    throw new Error('Missing required authentication environment variables');
  }

  return {
    userPoolId,
    userPoolClientId,
    userPoolDomain,
    region,
    cloudFrontUrl,
  };
};
