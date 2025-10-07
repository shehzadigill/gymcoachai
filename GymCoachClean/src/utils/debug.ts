import {Amplify} from 'aws-amplify';

// Test Amplify configuration for debugging
export const testAmplifyConfig = () => {
  console.log('Testing Amplify configuration...');

  const config = {
    Auth: {
      Cognito: {
        userPoolId: 'eu-north-1_dE19nCAjn',
        userPoolClientId: '10ukk27kmnj1ba86dpmqc6amu6',
        loginWith: {
          email: true,
          username: true,
        },
      },
    },
  };

  console.log('Amplify config:', JSON.stringify(config, null, 2));

  try {
    Amplify.configure(config);
    console.log('✅ Amplify configured successfully');
    return true;
  } catch (error) {
    console.error('❌ Amplify configuration failed:', error);
    return false;
  }
};

export const testCognitoConnection = async () => {
  try {
    console.log('Testing Cognito connection...');

    // Try to make a basic request to Cognito
    const response = await fetch(
      'https://cognito-idp.eu-north-1.amazonaws.com/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.ListUsers',
        },
        body: JSON.stringify({}),
      },
    );

    console.log('Cognito endpoint response status:', response.status);
    return response.status === 400; // 400 is expected for unauthorized request
  } catch (error) {
    console.error('Cognito connection test failed:', error);
    return false;
  }
};
