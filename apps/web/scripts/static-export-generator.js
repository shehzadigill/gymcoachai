const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration for static export
const config = {
  locales: ['en', 'ar', 'sv'],
  staticRoutes: [
    '/',
    '/pricing',
    '/terms',
    '/privacy',
    '/auth/signin',
    '/auth/signup',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/codeVerification',
  ],
  dynamicRoutes: [
    '/dashboard',
    '/profile',
    '/workouts',
    '/ai-trainer',
    '/analytics',
    '/nutrition',
    '/sleep',
  ],
};

async function generateStaticExport() {
  console.log('🚀 Starting static export generation for S3...');

  try {
    // Set environment for static export
    process.env.NEXT_EXPORT = 'true';

    // Build the application
    console.log('📦 Building Next.js application...');
    execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });

    console.log('✅ Static export completed successfully!');
    console.log('📁 Files generated in "out" directory');

    // List generated files
    const outDir = path.join(process.cwd(), 'out');
    if (fs.existsSync(outDir)) {
      console.log('📋 Generated files:');
      const files = fs.readdirSync(outDir, { recursive: true });
      files.slice(0, 20).forEach((file) => {
        if (typeof file === 'string' && file.endsWith('.html')) {
          console.log(`  - ${file}`);
        }
      });
    }

    console.log('\n🎯 Ready for S3 deployment!');
    console.log('📝 Next steps:');
    console.log('1. Upload "out" directory contents to your S3 bucket');
    console.log('2. Configure S3 bucket for static website hosting');
    console.log('3. Set up CloudFront CDN (recommended)');
    console.log('4. Configure custom domain (optional)');
  } catch (error) {
    console.error('❌ Static export failed:', error.message);
    process.exit(1);
  }
}

generateStaticExport();
