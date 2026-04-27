CREATE TABLE "npi_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"deal_id" uuid,
	"contact_id" uuid,
	"field_accessed" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purpose" text
);
--> statement-breakpoint
CREATE INDEX "npi_access_log_user_email_idx" ON "npi_access_log" USING btree ("user_email","accessed_at");--> statement-breakpoint
CREATE INDEX "npi_access_log_deal_id_idx" ON "npi_access_log" USING btree ("deal_id","accessed_at");--> statement-breakpoint
CREATE INDEX "npi_access_log_contact_id_idx" ON "npi_access_log" USING btree ("contact_id","accessed_at");