CREATE TYPE "public"."tier_permission" AS ENUM('SCRUD', 'SCRUDQ', 'MCRUD', 'MCRUDQ');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'expired', 'cancelled', 'pending');--> statement-breakpoint
CREATE TYPE "public"."razorpay_payment_status" AS ENUM('pending', 'authorized', 'captured', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."stripe_payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."paypal_payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_audit_action" AS ENUM('created', 'authorized', 'captured', 'succeeded', 'failed', 'refunded', 'cancelled', 'subscription_activated', 'subscription_cancelled', 'subscription_renewed', 'limit_decremented', 'limit_reset');--> statement-breakpoint
CREATE TYPE "public"."webhook_provider" AS ENUM('razorpay', 'stripe', 'paypal');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."refund_initiator" AS ENUM('admin', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."refund_provider" AS ENUM('razorpay', 'stripe', 'paypal');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'processed', 'failed');--> statement-breakpoint
CREATE TABLE "tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"limit" integer DEFAULT 3 NOT NULL,
	"rate_limit" integer DEFAULT 10000 NOT NULL,
	"permission" "tier_permission" DEFAULT 'SCRUD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tiers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"discount_percentage" numeric(5, 2) NOT NULL,
	"final_price" numeric(10, 2) NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"max_uses" integer DEFAULT 0 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"is_subscribed" boolean DEFAULT false NOT NULL,
	"tier_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"limit_left" integer DEFAULT 3 NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "razorpay_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"status" "razorpay_payment_status" DEFAULT 'pending' NOT NULL,
	"razorpay_order_id" varchar(100) NOT NULL,
	"razorpay_payment_id" varchar(100),
	"razorpay_signature" varchar(256),
	"amount" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"discount_id" uuid,
	"notes" jsonb,
	"failure_reason" text,
	"refunded_amount" integer,
	"refunded_at" timestamp with time zone,
	"is_partial_refund" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "razorpay_payments_razorpay_order_id_unique" UNIQUE("razorpay_order_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"status" "stripe_payment_status" DEFAULT 'pending' NOT NULL,
	"stripe_session_id" varchar(200) NOT NULL,
	"stripe_payment_intent_id" varchar(200),
	"stripe_customer_id" varchar(200),
	"stripe_subscription_id" varchar(200),
	"amount" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"discount_id" uuid,
	"failure_message" text,
	"refunded_amount" integer,
	"refunded_at" timestamp with time zone,
	"is_partial_refund" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_payments_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "paypal_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"status" "paypal_payment_status" DEFAULT 'pending' NOT NULL,
	"paypal_order_id" varchar(100) NOT NULL,
	"paypal_capture_id" varchar(100),
	"paypal_payer_id" varchar(100),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"discount_id" uuid,
	"metadata" jsonb,
	"failure_reason" text,
	"refunded_amount" numeric(10, 2),
	"refunded_at" timestamp with time zone,
	"is_partial_refund" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paypal_payments_paypal_order_id_unique" UNIQUE("paypal_order_id")
);
--> statement-breakpoint
CREATE TABLE "payment_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"payment_id" uuid,
	"provider" varchar(20) NOT NULL,
	"action" "payment_audit_action" NOT NULL,
	"previous_status" varchar(50),
	"new_status" varchar(50),
	"payload" jsonb,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "webhook_provider" NOT NULL,
	"event_id" varchar(300) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"status" "webhook_status" DEFAULT 'processed' NOT NULL,
	"payload" jsonb,
	"error_message" varchar(500),
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_usage_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_id" varchar(64),
	"action" varchar(30) DEFAULT 'decrement' NOT NULL,
	"limit_before" integer NOT NULL,
	"limit_after" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider" "refund_provider" NOT NULL,
	"provider_refund_id" varchar(255),
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"is_partial" boolean DEFAULT false NOT NULL,
	"reason" varchar(255),
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"initiated_by" "refund_initiator" DEFAULT 'admin' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_tier_id_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_tier_id_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "razorpay_payments" ADD CONSTRAINT "razorpay_payments_tier_id_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "razorpay_payments" ADD CONSTRAINT "razorpay_payments_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payments" ADD CONSTRAINT "stripe_payments_tier_id_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payments" ADD CONSTRAINT "stripe_payments_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paypal_payments" ADD CONSTRAINT "paypal_payments_tier_id_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paypal_payments" ADD CONSTRAINT "paypal_payments_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tiers_active" ON "tiers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_discounts_tier" ON "discounts" USING btree ("tier_id");--> statement-breakpoint
CREATE INDEX "idx_discounts_code" ON "discounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_discounts_active" ON "discounts" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_subscriptions_user_id" ON "user_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_tier" ON "user_subscriptions" USING btree ("tier_id");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_status" ON "user_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rzp_user" ON "razorpay_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rzp_status" ON "razorpay_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rzp_order_id" ON "razorpay_payments" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "idx_stripe_user" ON "stripe_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stripe_status" ON "stripe_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_stripe_session" ON "stripe_payments" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "idx_stripe_customer" ON "stripe_payments" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_stripe_subscription" ON "stripe_payments" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_paypal_user" ON "paypal_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_paypal_status" ON "paypal_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_paypal_order" ON "paypal_payments" USING btree ("paypal_order_id");--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "payment_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_payment" ON "payment_audit_log" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_audit_provider" ON "payment_audit_log" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "payment_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_created_at" ON "payment_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_webhook_event_id_unique" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_provider" ON "webhook_events" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_webhook_status" ON "webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_usage_log_user" ON "subscription_usage_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_usage_log_created" ON "subscription_usage_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_refunds_user_id" ON "refunds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refunds_payment_id" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_refunds_provider" ON "refunds" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_refunds_status" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_refunds_created_at" ON "refunds" USING btree ("created_at");