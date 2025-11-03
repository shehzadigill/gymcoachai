import { configureAuth } from '@packages/auth';

// Configure authentication for the web app
export const initializeAuth = () => {
  try {
    const userPoolId = process.env.NEXT_PUBLIC_USER_POOL_ID || '';
    const userPoolClientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || '';
    const userPoolDomain = process.env.NEXT_PUBLIC_USER_POOL_DOMAIN || '';
    const region = process.env.NEXT_PUBLIC_AWS_REGION || 'eu-west-1';
    const cloudFrontUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_URL || '';
    if (!userPoolId || !userPoolClientId || !userPoolDomain || !cloudFrontUrl) {
      throw new Error('Missing required authentication environment variables');
    }

    configureAuth({
      userPoolId,
      userPoolClientId,
      userPoolDomain,
      region,
      cloudFrontUrl,
    });
    console.log('Authentication configured successfully');
  } catch (error) {
    console.error('Failed to configure authentication:', error);
    // Do not proceed with a broken config; ensure .env.local is set and restart dev server
  }
};
