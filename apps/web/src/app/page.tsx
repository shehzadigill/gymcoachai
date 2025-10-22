import LocaleRedirect from './LocaleRedirect';

// This page handles client-side redirection to the preferred locale
// Since this is a static export, middleware won't work, so we use client-side JS
export default function RootPage() {
  return <LocaleRedirect />;
}
