import { cache } from 'react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { agents, type Agent } from '@/lib/db/schema';

// Lazy upsert (CTO answer A5): on first authenticated request for a Clerk
// user, insert a row in `agents` with onboardingCompleted=false. Cached for
// the request lifecycle via React.cache so it runs at most once per render.
export const ensureAgent = cache(async (): Promise<Agent> => {
  const { userId } = await auth.protect();

  const existing = await db
    .select()
    .from(agents)
    .where(eq(agents.clerkUserId, userId))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    email ||
    'Agent';

  const [created] = await db
    .insert(agents)
    .values({
      clerkUserId: userId,
      name,
      email,
      phone: '',
    })
    .returning();

  if (!created) {
    throw new Error('Failed to create agent row');
  }
  return created;
});
