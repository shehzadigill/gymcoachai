import { NextResponse } from 'next/server';

// Configure for static export compatibility
export const dynamic = 'force-static';

export async function GET() {
  // Return static response in static export mode
  if (process.env.NEXT_EXPORT === 'true') {
    return NextResponse.json({
      message: 'API Proxy not available in static export mode',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });
  }
  
  return NextResponse.json({
    message: 'API Proxy is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
}