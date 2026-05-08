import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  jsonb,
  date,
  index,
} from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  twilioNumber: text('twilio_number').unique(),
  calendlyUrl: text('calendly_url'),
  marketArea: text('market_area'),
  preferredLanguage: text('preferred_language').default('en'),
  voicemailUrl: text('voicemail_url'),
  timezone: text('timezone').default('America/New_York'),
  inboundEmailAlias: text('inbound_email_alias').unique(),
  onboardingCompleted: boolean('onboarding_completed').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .references(() => agents.id, { onDelete: 'cascade' })
      .notNull(),

    name: text('name'),
    email: text('email'),
    phone: text('phone'),

    budget: text('budget'),
    neighborhood: text('neighborhood'),
    reason: text('reason'),
    timeline: text('timeline'),
    detectedLanguage: text('detected_language').default('en'),

    aiScore: text('ai_score'),
    aiReasoning: text('ai_reasoning'),
    suggestedAction: text('suggested_action'),
    priority: integer('priority'),

    status: text('status').default('new').notNull(),
    followUpStage: integer('follow_up_stage').default(0).notNull(),
    paused: boolean('paused').default(false).notNull(),

    source: text('source').notNull(),
    sourceMetadata: jsonb('source_metadata'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastContactAt: timestamp('last_contact_at'),
    repliedAt: timestamp('replied_at'),
  },
  (table) => ({
    agentIdIdx: index('leads_agent_id_idx').on(table.agentId),
    statusIdx: index('leads_status_idx').on(table.status),
    createdAtIdx: index('leads_created_at_idx').on(table.createdAt.desc()),
  }),
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id')
      .references(() => leads.id, { onDelete: 'cascade' })
      .notNull(),

    direction: text('direction').notNull(),
    channel: text('channel').notNull(),
    content: text('content').notNull(),
    subject: text('subject'),

    aiGenerated: boolean('ai_generated').default(false).notNull(),
    aiModel: text('ai_model'),

    detectedIntent: text('detected_intent'),
    detectedLanguage: text('detected_language'),

    externalId: text('external_id'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    leadCreatedIdx: index('messages_lead_id_created_at_idx').on(
      table.leadId,
      table.createdAt.desc(),
    ),
  }),
);

export const workflowRuns = pgTable(
  'workflow_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    workflowName: text('workflow_name').notNull(),
    status: text('status').notNull(),
    vercelRunId: text('vercel_run_id'),
    error: text('error'),
    metadata: jsonb('metadata'),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    leadStartedIdx: index('workflow_runs_lead_id_started_at_idx').on(
      table.leadId,
      table.startedAt.desc(),
    ),
  }),
);

export const briefings = pgTable('briefings', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .references(() => agents.id, { onDelete: 'cascade' })
    .notNull(),
  date: date('date').notNull(),
  language: text('language').default('en').notNull(),
  summary: text('summary').notNull(),
  hotLeadIds: uuid('hot_lead_ids').array(),
  newRepliesCount: integer('new_replies_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type NewWorkflowRun = typeof workflowRuns.$inferInsert;
export type Briefing = typeof briefings.$inferSelect;
export type NewBriefing = typeof briefings.$inferInsert;
