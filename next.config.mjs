import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
};

// Sentry build options. Source-map upload is intentionally disabled in Week 1
// (no SENTRY_AUTH_TOKEN set yet — see CTO answer A6). Add it when traces
// become unreadable.
export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  hideSourceMaps: true,
  // org / project / authToken intentionally omitted; source maps not uploaded.
});
