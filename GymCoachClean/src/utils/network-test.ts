// Network connectivity test for AWS services
export const testCognitoConnectivity = async () => {
  try {
    console.log('Testing Cognito connectivity...');

    // Test basic network connectivity
    const response = await fetch(
      'https://cognito-idp.eu-west-1.amazonaws.com/',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
        },
      },
    );

    console.log('Cognito endpoint response status:', response.status);
    console.log('Cognito endpoint response headers:', response.headers);

    return response.status;
  } catch (error) {
    console.error('Network connectivity test failed:', error);
    return false;
  }
};

export const testAPIConnectivity = async () => {
  try {
    console.log('Testing API connectivity...');

    const response = await fetch(
      'https://d202qmtk8kkxra.cloudfront.net/health',
      {
        method: 'GET',
      },
    );

    console.log('API endpoint response status:', response.status);
    return response.status;
  } catch (error) {
    console.error('API connectivity test failed:', error);
    return false;
  }
};
