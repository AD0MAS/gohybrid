CREATE TYPE "public"."body_metric_type" AS ENUM('weight', 'body_fat', 'resting_hr');--> statement-breakpoint
CREATE TABLE "body_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"metric_type" "body_metric_type" NOT NULL,
	"value" numeric(6, 2) NOT NULL,
	"measured_at" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "body_metrics" ADD CONSTRAINT "body_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "body_metrics_user_id_metric_type_measured_at_idx" ON "body_metrics" USING btree ("user_id","metric_type","measured_at");