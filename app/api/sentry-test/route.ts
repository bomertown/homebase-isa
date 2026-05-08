// Deliberately throws so we can verify Sentry is wired (CTO answer A6).
// Hit GET /api/sentry-test once after deploy, confirm event in Sentry, leave route in place.
export const dynamic = 'force-dynamic';

export function GET() {
  throw new Error('Sentry test error from /api/sentry-test');
}
