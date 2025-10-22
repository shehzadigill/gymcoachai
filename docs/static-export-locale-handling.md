# Locale Persistence for Static Export (S3/CloudFront)

## Overview

Since the app is deployed as a static export to S3, we use a **three-layer approach** to handle locale persistence and routing:

1. **CloudFront Function** (Edge-level)
2. **Client-side Redirect** (Browser-level)
3. **LocalStorage + Cookies** (Persistence)

## Why Not Middleware?

❌ **Next.js Middleware does NOT work with static exports** because:

- Middleware requires a Node.js server
- Static exports are just HTML/CSS/JS files
- No server-side processing happens with S3 hosting

## Architecture

### Layer 1: CloudFront Function (Edge)

**Location**: `infrastructure/src/gymcoach-ai-stack.ts`

**Purpose**: Handle root path (`/`) redirects at the CDN edge level

**How it works**:

```javascript
// When user visits root path /
if (uri === '/' || uri === '') {
  // 1. Check for preferredLocale cookie
  // 2. Redirect to /{locale} (e.g., /en, /sv, /ar)
  // 3. Default to /en if no cookie found
}
```

**Advantages**:

- ✅ Fastest possible redirect (at CDN edge)
- ✅ No JavaScript needed initially
- ✅ Works even with JavaScript disabled

### Layer 2: Client-side Redirect

**Location**: `apps/web/src/app/LocaleRedirect.tsx` + `apps/web/src/app/page.tsx`

**Purpose**: Fallback for root path visits if CloudFront function doesn't catch it

**How it works**:

```typescript
// On page load:
1. Check current pathname
2. If no locale prefix found
3. Get preferred locale from localStorage or cookie
4. Redirect to /{locale}{pathname}
```

**When this runs**:

- User visits root path and CloudFront function redirects to `/index.html`
- Direct file access bypassing CloudFront
- During local development

### Layer 3: Locale Persistence

**Locations**:

- `apps/web/src/components/LanguageSwitcher.tsx`
- `apps/web/src/components/LocaleSync.tsx`
- `apps/web/src/app/[locale]/client-layout.tsx`

**Purpose**: Remember user's language preference across visits

**Storage**:

- **localStorage**: `preferredLocale` = 'en' | 'ar' | 'sv'
- **Cookie**: `preferredLocale` = 'en' | 'ar' | 'sv' (max-age: 1 year)

**Why both?**:

- localStorage: Fast client-side access, persists across sessions
- Cookie: Can be read by CloudFront function for edge-level redirects

## User Journey

### First-Time Visitor

```
1. User visits https://example.com/
2. CloudFront: No preferredLocale cookie found
3. CloudFront: Redirects to /en (default)
4. Browser: Loads /en/index.html
5. Client: Sets localStorage.preferredLocale = 'en'
6. Client: Sets cookie preferredLocale = 'en'
```

### Returning Visitor (English)

```
1. User visits https://example.com/
2. CloudFront: Reads preferredLocale cookie = 'en'
3. CloudFront: Redirects to /en
4. Browser: Loads /en/index.html
```

### User Changes Language to Swedish

```
1. User clicks language switcher → Swedish
2. LanguageSwitcher saves to localStorage and cookie
3. Router navigates to /sv + current path
4. Router.refresh() updates translations immediately
5. Next visit: CloudFront redirects to /sv automatically
```

### Direct Navigation (e.g., bookmark)

```
1. User visits https://example.com/en/dashboard
2. CloudFront: Path already has locale, serves file
3. Browser: Loads /en/dashboard/index.html
4. Client: Syncs locale 'en' to localStorage and cookie
```

## File Structure

```
apps/web/src/
├── app/
│   ├── page.tsx                    # Root page with LocaleRedirect
│   ├── LocaleRedirect.tsx          # Client-side redirect component
│   ├── [locale]/
│   │   ├── layout.tsx              # Locale layout wrapper
│   │   ├── client-layout.tsx       # Main app layout (syncs locale)
│   │   └── (pages)...
│   └── ...
├── components/
│   ├── LanguageSwitcher.tsx        # Language selector (persists choice)
│   └── LocaleSync.tsx              # Syncs localStorage to cookies
├── middleware.ts                   # ⚠️ NOT USED (for reference only)
└── i18n/
    ├── config.ts                   # Locale definitions
    └── request.ts                  # Next-intl config
```

## Important Notes

### ✅ What Works

- All paths MUST include locale prefix: `/en/dashboard`, `/sv/profile`
- Language switcher persists choice across sessions
- CloudFront handles root redirect efficiently
- Translations update immediately on language change

### ⚠️ Limitations

- No server-side locale detection (e.g., from Accept-Language header)
- Root path (`/`) requires redirect (can't serve content directly)
- Middleware is not functional (static export limitation)

### 🔧 Development vs Production

**Development** (next dev):

- Middleware may work if not using static export
- LocaleRedirect provides fallback

**Production** (S3 + CloudFront):

- Only CloudFront function + client-side code works
- Middleware is completely ignored

## Testing Checklist

- [ ] Visit root path → redirects to `/en`
- [ ] Change language to Swedish → goes to `/sv` and persists
- [ ] Refresh page → stays on `/sv`
- [ ] Navigate to different pages → locale prefix maintained
- [ ] Close browser, reopen, visit root → redirects to last selected locale
- [ ] Clear cookies and localStorage → defaults to `/en`
- [ ] Direct link to `/en/dashboard` → works correctly
- [ ] Direct link to `/sv/profile` → works correctly

## Deployment Checklist

### Frontend (S3)

1. Build static export: `NEXT_EXPORT=true npm run build`
2. Ensure `out/` directory has locale folders: `en/`, `ar/`, `sv/`
3. Upload to S3 with proper MIME types
4. Set cache headers appropriately

### Infrastructure (CloudFront)

1. Deploy CloudFront function with locale redirect logic
2. Attach function to viewer request event
3. Configure cache behaviors for locale paths
4. Test cookie reading in CloudFront function

### Verify

```bash
# Test root redirect
curl -I https://your-domain.com/
# Should get 302 redirect to /en

# Test with cookie
curl -I -H "Cookie: preferredLocale=sv" https://your-domain.com/
# Should get 302 redirect to /sv

# Test locale path
curl -I https://your-domain.com/en/dashboard/
# Should get 200 OK
```

## Troubleshooting

### Issue: Root path shows 404

**Cause**: CloudFront function not deployed or not attached to distribution

**Solution**:

1. Check CloudFront function exists
2. Verify function is attached to viewer-request event
3. Check CloudFront logs

### Issue: Language doesn't persist

**Cause**: Cookies not being set or read correctly

**Solution**:

1. Check browser console for cookie errors
2. Verify cookie domain matches your domain
3. Check SameSite and Secure flags

### Issue: Translations don't update on language change

**Cause**: Router not refreshing properly

**Solution**:

- Ensure `router.refresh()` is called after navigation
- Check that locale prop is passed to all layouts
- Verify messages are loaded for all locales

## Additional Resources

- [Next.js Static Exports](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [CloudFront Functions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html)
- [Next-intl Documentation](https://next-intl-docs.vercel.app/)
