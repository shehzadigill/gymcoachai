import { NextRequest, NextResponse } from 'next/server';

// Force dynamic behavior for this API route (required for proxy functionality)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CLOUDFRONT_URL =
  process.env.NEXT_PUBLIC_CLOUDFRONT_URL ||
  'https://d12pveuxxq3vvn.cloudfront.net';

export async function GET(request: NextRequest) {
  // Return 404 in static export mode since API routes are not available
  if (process.env.NEXT_EXPORT === 'true') {
    return NextResponse.json(
      { error: 'API routes not available in static export mode' },
      { status: 404 }
    );
  }
  return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  // Return 404 in static export mode since API routes are not available
  if (process.env.NEXT_EXPORT === 'true') {
    return NextResponse.json(
      { error: 'API routes not available in static export mode' },
      { status: 404 }
    );
  }
  return proxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  // Return 404 in static export mode since API routes are not available
  if (process.env.NEXT_EXPORT === 'true') {
    return NextResponse.json(
      { error: 'API routes not available in static export mode' },
      { status: 404 }
    );
  }
  return proxyRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  // Return 404 in static export mode since API routes are not available
  if (process.env.NEXT_EXPORT === 'true') {
    return NextResponse.json(
      { error: 'API routes not available in static export mode' },
      { status: 404 }
    );
  }
  return proxyRequest(request, 'DELETE');
}

export async function PATCH(request: NextRequest) {
  // Return 404 in static export mode since API routes are not available
  if (process.env.NEXT_EXPORT === 'true') {
    return NextResponse.json(
      { error: 'API routes not available in static export mode' },
      { status: 404 }
    );
  }
  return proxyRequest(request, 'PATCH');
}

async function proxyRequest(request: NextRequest, method: string) {
  try {
    // Extract the API path from the request URL
    const url = new URL(request.url);
    const apiPath = url.pathname.replace('/api/proxy', '');
    const searchParams = url.searchParams.toString();
    console.log('API Path:', apiPath);
    const targetUrl = `${CLOUDFRONT_URL}${apiPath}${searchParams ? `?${searchParams}` : ''}`;

    console.log(
      `Proxying ${method} request from ${url.pathname} to ${targetUrl}`
    );

    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);

    // Prepare headers for the target request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Add authorization header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Get request body for methods that support it
    let body;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const textBody = await request.text();
        if (textBody) {
          body = textBody;
        }
      } catch (e) {
        console.log('No body or failed to read body:', e);
      }
    }
    console.log('targetUrl', targetUrl);
    // Make the request to the target API
    const response = await fetch(
      targetUrl.endsWith('/') && targetUrl.length > 1
        ? targetUrl.slice(0, -1)
        : targetUrl,
      {
        method,
        headers,
        body,
      }
    );

    console.log('Target API response status:', response.status);

    // Get the response body
    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      // If it's not JSON, return as text
      responseData = responseText;
    }

    // Return the response with CORS headers
    return NextResponse.json(responseData, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods':
          'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Proxy request failed:', error);
    return NextResponse.json(
      {
        error: 'Proxy request failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods':
            'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
