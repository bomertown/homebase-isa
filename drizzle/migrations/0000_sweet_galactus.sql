CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"twilio_number" text,
	"calendly_url" text,
	"market_area" text,
	"preferred_language" text DEFAULT 'en',
	"voicemail_url" text,
	"timezone" text DEFAULT 'America/New_York',
	"inbound_email_alias" text,
	"onboarding_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agents_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "agents_twilio_number_unique" UNIQUE("twilio_number"),
	CONSTRAINT "agents_inbound_email_alias_unique" UNIQUE("inbound_email_alias")
);
--> statement-breakpoint
CREATE TABLE "briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"date" date NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"summary" text NOT NULL,
	"hot_lead_ids" uuid[],
	"new_replies_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"name" text,
	"email" text,
	"phone" text,
	"budget" text,
	"neighborhood" text,
	"reason" text,
	"timeline" text,
	"detected_language" text DEFAULT 'en',
	"ai_score" text,
	"ai_reasoning" text,
	"suggested_action" text,
	"priority" integer,
	"status" text DEFAULT 'new' NOT NULL,
	"follow_up_stage" integer DEFAULT 0 NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"source_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_contact_at" timestamp,
	"replied_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"channel" text NOT NULL,
	"content" text NOT NULL,
	"subject" text,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"ai_model" text,
	"detected_intent" text,
	"detected_language" text,
	"external_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"agent_id" uuid,
	"workflow_name" text NOT NULL,
	"status" text NOT NULL,
	"vercel_run_id" text,
	"error" text,
	"metadata" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_agent_id_idx" ON "leads" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_lead_id_created_at_idx" ON "messages" USING btree ("lead_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workflow_runs_lead_id_started_at_idx" ON "workflow_runs" USING btree ("lead_id","started_at" DESC NULLS LAST);