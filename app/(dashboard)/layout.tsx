import { ensureAgent } from '@/lib/auth/clerk';

// Lazy upsert per CTO answer A5: every authenticated dashboard request
// guarantees an `agents` row exists for the Clerk user.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureAgent();
  return <div className="min-h-screen">{children}</div>;
}
