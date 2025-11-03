#!/usr/bin/env node

/**
 * Test script to verify the proxy server is working correctly
 * Run with: node test-proxy.js
 */

const https = require('https');
const http = require('http');

const PROXY_URL = 'http://localhost:3001';
const CLOUDFRONT_URL = 'https://d202qmtk8kkxra.cloudfront.net';

// Test functions
async function testHealthCheck() {
  console.log('🔍 Testing health check...');

  try {
    const response = await fetch(`${PROXY_URL}/health`);
    const data = await response.json();

    if (response.ok && data.status === 'OK') {
      console.log('✅ Health check passed:', data.message);
      return true;
    } else {
      console.log('❌ Health check failed:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    return false;
  }
}

async function testProxyAPI() {
  console.log('🔍 Testing proxy API...');

  try {
    // Test a simple API endpoint through the proxy
    const response = await fetch(`${PROXY_URL}/api/user-profiles/health`);

    console.log(`📡 Proxy response status: ${response.status}`);
    console.log(
      `📡 Proxy response headers:`,
      Object.fromEntries(response.headers.entries())
    );

    if (response.ok) {
      const data = await response.text();
      console.log('✅ Proxy API test passed');
      console.log(
        '📄 Response data:',
        data.substring(0, 200) + (data.length > 200 ? '...' : '')
      );
      return true;
    } else {
      console.log('❌ Proxy API test failed with status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Proxy API test error:', error.message);
    return false;
  }
}

async function testDirectCloudFront() {
  console.log('🔍 Testing direct CloudFront access...');

  try {
    const response = await fetch(`${CLOUDFRONT_URL}/api/user-profiles/health`);

    console.log(`📡 Direct CloudFront response status: ${response.status}`);

    if (response.ok) {
      console.log('✅ Direct CloudFront access works');
      return true;
    } else {
      console.log(
        '❌ Direct CloudFront access failed with status:',
        response.status
      );
      return false;
    }
  } catch (error) {
    console.log('❌ Direct CloudFront access error:', error.message);
    return false;
  }
}

async function testCORSHeaders() {
  console.log('🔍 Testing CORS headers...');

  try {
    const response = await fetch(`${PROXY_URL}/api/user-profiles/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });

    const corsHeaders = {
      'Access-Control-Allow-Origin': response.headers.get(
        'Access-Control-Allow-Origin'
      ),
      'Access-Control-Allow-Methods': response.headers.get(
        'Access-Control-Allow-Methods'
      ),
      'Access-Control-Allow-Headers': response.headers.get(
        'Access-Control-Allow-Headers'
      ),
      'Access-Control-Allow-Credentials': response.headers.get(
        'Access-Control-Allow-Credentials'
      ),
    };

    console.log('📡 CORS headers:', corsHeaders);

    if (corsHeaders['Access-Control-Allow-Origin']) {
      console.log('✅ CORS headers present');
      return true;
    } else {
      console.log('❌ CORS headers missing');
      return false;
    }
  } catch (error) {
    console.log('❌ CORS test error:', error.message);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting GymCoach AI Proxy Server Tests\n');

  const results = {
    healthCheck: await testHealthCheck(),
    proxyAPI: await testProxyAPI(),
    directCloudFront: await testDirectCloudFront(),
    corsHeaders: await testCORSHeaders(),
  };

  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(`Health Check: ${results.healthCheck ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Proxy API: ${results.proxyAPI ? '✅ PASS' : '❌ FAIL'}`);
  console.log(
    `Direct CloudFront: ${results.directCloudFront ? '✅ PASS' : '❌ FAIL'}`
  );
  console.log(`CORS Headers: ${results.corsHeaders ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every((result) => result);

  console.log(
    '\n' +
      (allPassed
        ? '🎉 All tests passed!'
        : '⚠️  Some tests failed. Check the logs above.')
  );

  if (allPassed) {
    console.log('\n✨ Your proxy server is ready for development!');
    console.log('🔗 Use http://localhost:3001/api/* for your API calls');
  }

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch((error) => {
  console.error('💥 Test runner error:', error);
  process.exit(1);
});
