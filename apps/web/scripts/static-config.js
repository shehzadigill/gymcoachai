// Simplified static export configuration
// This focuses on generating static files for key pages only

const { locales } = require('../src/i18n/config');

// Generate static params for key pages
const generateStaticParams = () => {
  return locales.map((locale) => ({
    locale: locale,
  }));
};

// Export configuration for static generation
module.exports = {
  generateStaticParams,
  locales,
  // Key pages that can be statically generated
  staticPages: [
    '/',
    '/pricing',
    '/privacy',
    '/terms',
    '/auth/signin',
    '/auth/signup',
  ],
};
