CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"record_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb NOT NULL,
	"user_id" uuid NOT NULL,
	"user_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_operation_check" CHECK ("audit_log"."operation" IN ('create', 'update', 'delete'))
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"file_no" text NOT NULL,
	"title" text NOT NULL,
	"priority" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"main_contact_name" text,
	"main_contact_email" text,
	"main_contact_phone" text,
	"property_address" text,
	"property_state" text,
	"property_type" text,
	"sales_price" integer,
	"loan_type" text,
	"transaction_type" text,
	"loan_amount" integer,
	"estimated_down" integer,
	"earnest_money" integer,
	"est_rehab" integer,
	"arv" integer,
	"title_ctc" boolean DEFAULT false NOT NULL,
	"lender_ctc" boolean DEFAULT false NOT NULL,
	"title_file_no" text,
	"loan_no" text,
	"service_selected" text,
	"quick_note" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closing_at" timestamp with time zone,
	"funding_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"internal_owner" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_file_no_unique" UNIQUE("file_no"),
	CONSTRAINT "deals_priority_check" CHECK ("deals"."priority" IN ('HIGH', 'MEDIUM', 'LOW')),
	CONSTRAINT "deals_status_check" CHECK ("deals"."status" IN ('active', 'closed', 'killed'))
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"track_id" uuid,
	"sort_order" integer NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	CONSTRAINT "stages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"default_priority" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "tracks_code_unique" UNIQUE("code"),
	CONSTRAINT "tracks_default_priority_check" CHECK ("tracks"."default_priority" IN ('HIGH', 'MEDIUM', 'LOW'))
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_internal_owner_users_id_fk" FOREIGN KEY ("internal_owner") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_record_idx" ON "audit_log" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_desc_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deals_file_no_idx" ON "deals" USING btree ("file_no");--> statement-breakpoint
CREATE INDEX "deals_track_id_idx" ON "deals" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "deals_stage_id_idx" ON "deals" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "deals_status_idx" ON "deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deals_internal_owner_idx" ON "deals" USING btree ("internal_owner");--> statement-breakpoint
CREATE INDEX "deals_created_at_desc_idx" ON "deals" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "npi_access_log" ADD CONSTRAINT "npi_access_log_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;