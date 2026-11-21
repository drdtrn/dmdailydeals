import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_blog_briefs_experience_source" AS ENUM('human', 'ai');
  CREATE TYPE "public"."enum_blog_briefs_status" AS ENUM('queued', 'researching', 'writing', 'ready', 'failed');
  CREATE TYPE "public"."enum_site_settings_ai_provider" AS ENUM('deepseek', 'openai');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'generateBlogDraft' BEFORE 'schedulePublish';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'generateBlogDraft' BEFORE 'schedulePublish';
  CREATE TABLE "posts_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "_posts_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "users_same_as" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "blog_briefs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"topic" varchar NOT NULL,
  	"target_keyword" varchar NOT NULL,
  	"category_id" integer NOT NULL,
  	"angle" varchar,
  	"target_words" numeric DEFAULT 1500,
  	"experience_source" "enum_blog_briefs_experience_source" DEFAULT 'ai' NOT NULL,
  	"first_hand_notes" varchar,
  	"status" "enum_blog_briefs_status" DEFAULT 'queued' NOT NULL,
  	"post_id" integer,
  	"error" varchar,
  	"estimated_cost_usd" numeric,
  	"created_by_id" integer,
  	"research" jsonb,
  	"usage" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "blog_briefs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"deals_id" integer,
  	"categories_id" integer
  );
  
  ALTER TABLE "posts_populated_authors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_version_populated_authors" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "posts_populated_authors" CASCADE;
  DROP TABLE "_posts_v_version_populated_authors" CASCADE;
  ALTER TABLE "posts_rels" DROP CONSTRAINT "posts_rels_categories_fk";
  
  ALTER TABLE "posts_rels" DROP CONSTRAINT "posts_rels_users_fk";
  
  ALTER TABLE "_posts_v_rels" DROP CONSTRAINT "_posts_v_rels_categories_fk";
  
  ALTER TABLE "_posts_v_rels" DROP CONSTRAINT "_posts_v_rels_users_fk";
  
  DROP INDEX "posts_rels_categories_id_idx";
  DROP INDEX "posts_rels_users_id_idx";
  DROP INDEX "_posts_v_rels_categories_id_idx";
  DROP INDEX "_posts_v_rels_users_id_idx";
  ALTER TABLE "posts" ADD COLUMN "category_id" integer;
  ALTER TABLE "posts" ADD COLUMN "author_id" integer;
  ALTER TABLE "posts" ADD COLUMN "ai_assisted" boolean DEFAULT false;
  ALTER TABLE "posts" ADD COLUMN "reviewed_by_id" integer;
  ALTER TABLE "posts" ADD COLUMN "reviewed_at" timestamp(3) with time zone;
  ALTER TABLE "posts_rels" ADD COLUMN "deals_id" integer;
  ALTER TABLE "_posts_v" ADD COLUMN "version_category_id" integer;
  ALTER TABLE "_posts_v" ADD COLUMN "version_author_id" integer;
  ALTER TABLE "_posts_v" ADD COLUMN "version_ai_assisted" boolean DEFAULT false;
  ALTER TABLE "_posts_v" ADD COLUMN "version_reviewed_by_id" integer;
  ALTER TABLE "_posts_v" ADD COLUMN "version_reviewed_at" timestamp(3) with time zone;
  ALTER TABLE "_posts_v_rels" ADD COLUMN "deals_id" integer;
  ALTER TABLE "users" ADD COLUMN "display_name" varchar;
  ALTER TABLE "users" ADD COLUMN "bio" varchar;
  ALTER TABLE "users" ADD COLUMN "avatar_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "blog_briefs_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "ai_enabled" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "ai_provider" "enum_site_settings_ai_provider";
  ALTER TABLE "site_settings" ADD COLUMN "ai_model" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "ai_monthly_draft_cap" numeric DEFAULT 20;
  ALTER TABLE "posts_sources" ADD CONSTRAINT "posts_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_version_sources" ADD CONSTRAINT "_posts_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_same_as" ADD CONSTRAINT "users_same_as_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "blog_briefs" ADD CONSTRAINT "blog_briefs_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_briefs" ADD CONSTRAINT "blog_briefs_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_briefs" ADD CONSTRAINT "blog_briefs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_briefs_rels" ADD CONSTRAINT "blog_briefs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."blog_briefs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "blog_briefs_rels" ADD CONSTRAINT "blog_briefs_rels_deals_fk" FOREIGN KEY ("deals_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "blog_briefs_rels" ADD CONSTRAINT "blog_briefs_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_sources_order_idx" ON "posts_sources" USING btree ("_order");
  CREATE INDEX "posts_sources_parent_id_idx" ON "posts_sources" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_version_sources_order_idx" ON "_posts_v_version_sources" USING btree ("_order");
  CREATE INDEX "_posts_v_version_sources_parent_id_idx" ON "_posts_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "users_same_as_order_idx" ON "users_same_as" USING btree ("_order");
  CREATE INDEX "users_same_as_parent_id_idx" ON "users_same_as" USING btree ("_parent_id");
  CREATE INDEX "blog_briefs_category_idx" ON "blog_briefs" USING btree ("category_id");
  CREATE INDEX "blog_briefs_status_idx" ON "blog_briefs" USING btree ("status");
  CREATE INDEX "blog_briefs_post_idx" ON "blog_briefs" USING btree ("post_id");
  CREATE INDEX "blog_briefs_created_by_idx" ON "blog_briefs" USING btree ("created_by_id");
  CREATE INDEX "blog_briefs_updated_at_idx" ON "blog_briefs" USING btree ("updated_at");
  CREATE INDEX "blog_briefs_created_at_idx" ON "blog_briefs" USING btree ("created_at");
  CREATE INDEX "blog_briefs_rels_order_idx" ON "blog_briefs_rels" USING btree ("order");
  CREATE INDEX "blog_briefs_rels_parent_idx" ON "blog_briefs_rels" USING btree ("parent_id");
  CREATE INDEX "blog_briefs_rels_path_idx" ON "blog_briefs_rels" USING btree ("path");
  CREATE INDEX "blog_briefs_rels_deals_id_idx" ON "blog_briefs_rels" USING btree ("deals_id");
  CREATE INDEX "blog_briefs_rels_categories_id_idx" ON "blog_briefs_rels" USING btree ("categories_id");
  ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_deals_fk" FOREIGN KEY ("deals_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_author_id_users_id_fk" FOREIGN KEY ("version_author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_reviewed_by_id_users_id_fk" FOREIGN KEY ("version_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_deals_fk" FOREIGN KEY ("deals_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_blog_briefs_fk" FOREIGN KEY ("blog_briefs_id") REFERENCES "public"."blog_briefs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_category_idx" ON "posts" USING btree ("category_id");
  CREATE INDEX "posts_author_idx" ON "posts" USING btree ("author_id");
  CREATE INDEX "posts_reviewed_by_idx" ON "posts" USING btree ("reviewed_by_id");
  CREATE INDEX "posts_rels_deals_id_idx" ON "posts_rels" USING btree ("deals_id");
  CREATE INDEX "_posts_v_version_version_category_idx" ON "_posts_v" USING btree ("version_category_id");
  CREATE INDEX "_posts_v_version_version_author_idx" ON "_posts_v" USING btree ("version_author_id");
  CREATE INDEX "_posts_v_version_version_reviewed_by_idx" ON "_posts_v" USING btree ("version_reviewed_by_id");
  CREATE INDEX "_posts_v_rels_deals_id_idx" ON "_posts_v_rels" USING btree ("deals_id");
  CREATE INDEX "users_avatar_idx" ON "users" USING btree ("avatar_id");
  CREATE INDEX "payload_locked_documents_rels_blog_briefs_id_idx" ON "payload_locked_documents_rels" USING btree ("blog_briefs_id");
  ALTER TABLE "posts_rels" DROP COLUMN "categories_id";
  ALTER TABLE "posts_rels" DROP COLUMN "users_id";
  ALTER TABLE "_posts_v_rels" DROP COLUMN "categories_id";
  ALTER TABLE "_posts_v_rels" DROP COLUMN "users_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "posts_populated_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "_posts_v_version_populated_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"name" varchar
  );
  
  ALTER TABLE "posts_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_version_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_same_as" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "blog_briefs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "blog_briefs_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "posts_sources" CASCADE;
  DROP TABLE "_posts_v_version_sources" CASCADE;
  DROP TABLE "users_same_as" CASCADE;
  DROP TABLE "blog_briefs" CASCADE;
  DROP TABLE "blog_briefs_rels" CASCADE;
  ALTER TABLE "posts" DROP CONSTRAINT "posts_category_id_categories_id_fk";
  
  ALTER TABLE "posts" DROP CONSTRAINT "posts_author_id_users_id_fk";
  
  ALTER TABLE "posts" DROP CONSTRAINT "posts_reviewed_by_id_users_id_fk";
  
  ALTER TABLE "posts_rels" DROP CONSTRAINT "posts_rels_deals_fk";
  
  ALTER TABLE "_posts_v" DROP CONSTRAINT "_posts_v_version_category_id_categories_id_fk";
  
  ALTER TABLE "_posts_v" DROP CONSTRAINT "_posts_v_version_author_id_users_id_fk";
  
  ALTER TABLE "_posts_v" DROP CONSTRAINT "_posts_v_version_reviewed_by_id_users_id_fk";
  
  ALTER TABLE "_posts_v_rels" DROP CONSTRAINT "_posts_v_rels_deals_fk";
  
  ALTER TABLE "users" DROP CONSTRAINT "users_avatar_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_blog_briefs_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'publishDueDrops', 'revalidateDrop', 'pingIndexNow', 'postDropToTelegram', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'publishDueDrops', 'revalidateDrop', 'pingIndexNow', 'postDropToTelegram', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "posts_category_idx";
  DROP INDEX "posts_author_idx";
  DROP INDEX "posts_reviewed_by_idx";
  DROP INDEX "posts_rels_deals_id_idx";
  DROP INDEX "_posts_v_version_version_category_idx";
  DROP INDEX "_posts_v_version_version_author_idx";
  DROP INDEX "_posts_v_version_version_reviewed_by_idx";
  DROP INDEX "_posts_v_rels_deals_id_idx";
  DROP INDEX "users_avatar_idx";
  DROP INDEX "payload_locked_documents_rels_blog_briefs_id_idx";
  ALTER TABLE "posts_rels" ADD COLUMN "categories_id" integer;
  ALTER TABLE "posts_rels" ADD COLUMN "users_id" integer;
  ALTER TABLE "_posts_v_rels" ADD COLUMN "categories_id" integer;
  ALTER TABLE "_posts_v_rels" ADD COLUMN "users_id" integer;
  ALTER TABLE "posts_populated_authors" ADD CONSTRAINT "posts_populated_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_version_populated_authors" ADD CONSTRAINT "_posts_v_version_populated_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_populated_authors_order_idx" ON "posts_populated_authors" USING btree ("_order");
  CREATE INDEX "posts_populated_authors_parent_id_idx" ON "posts_populated_authors" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_version_populated_authors_order_idx" ON "_posts_v_version_populated_authors" USING btree ("_order");
  CREATE INDEX "_posts_v_version_populated_authors_parent_id_idx" ON "_posts_v_version_populated_authors" USING btree ("_parent_id");
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_rels_categories_id_idx" ON "posts_rels" USING btree ("categories_id");
  CREATE INDEX "posts_rels_users_id_idx" ON "posts_rels" USING btree ("users_id");
  CREATE INDEX "_posts_v_rels_categories_id_idx" ON "_posts_v_rels" USING btree ("categories_id");
  CREATE INDEX "_posts_v_rels_users_id_idx" ON "_posts_v_rels" USING btree ("users_id");
  ALTER TABLE "posts" DROP COLUMN "category_id";
  ALTER TABLE "posts" DROP COLUMN "author_id";
  ALTER TABLE "posts" DROP COLUMN "ai_assisted";
  ALTER TABLE "posts" DROP COLUMN "reviewed_by_id";
  ALTER TABLE "posts" DROP COLUMN "reviewed_at";
  ALTER TABLE "posts_rels" DROP COLUMN "deals_id";
  ALTER TABLE "_posts_v" DROP COLUMN "version_category_id";
  ALTER TABLE "_posts_v" DROP COLUMN "version_author_id";
  ALTER TABLE "_posts_v" DROP COLUMN "version_ai_assisted";
  ALTER TABLE "_posts_v" DROP COLUMN "version_reviewed_by_id";
  ALTER TABLE "_posts_v" DROP COLUMN "version_reviewed_at";
  ALTER TABLE "_posts_v_rels" DROP COLUMN "deals_id";
  ALTER TABLE "users" DROP COLUMN "display_name";
  ALTER TABLE "users" DROP COLUMN "bio";
  ALTER TABLE "users" DROP COLUMN "avatar_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "blog_briefs_id";
  ALTER TABLE "site_settings" DROP COLUMN "ai_enabled";
  ALTER TABLE "site_settings" DROP COLUMN "ai_provider";
  ALTER TABLE "site_settings" DROP COLUMN "ai_model";
  ALTER TABLE "site_settings" DROP COLUMN "ai_monthly_draft_cap";
  DROP TYPE "public"."enum_blog_briefs_experience_source";
  DROP TYPE "public"."enum_blog_briefs_status";
  DROP TYPE "public"."enum_site_settings_ai_provider";`)
}
