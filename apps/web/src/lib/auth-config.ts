import { configureAuth, getAuthConfig } from '../../../../packages/auth/dist';

// Configure authentication for the web app
export const initializeAuth = () => {
  try {
    const config = getAuthConfig();
    configureAuth(config);
    console.log('Authentication configured successfully');
  } catch (error) {
    console.error('Failed to configure authentication:', error);
    // Fallback configuration for development
    configureAuth({
      userPoolId:
        process.env.NEXT_PUBLIC_USER_POOL_ID || 'eu-north-1_XXXXXXXXX',
      userPoolClientId:
        process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID ||
        'xxxxxxxxxxxxxxxxxxxxxxxxxx',
      userPoolDomain:
        process.env.NEXT_PUBLIC_USER_POOL_DOMAIN ||
        'gymcoach-ai-dev.auth.eu-north-1.amazoncognito.com',
      region: process.env.NEXT_PUBLIC_AWS_REGION || 'eu-north-1',
      cloudFrontUrl:
        process.env.NEXT_PUBLIC_CLOUDFRONT_URL ||
        'https://d1234567890.cloudfront.net',
    });
  }
};
