import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'postDropToTelegram' BEFORE 'schedulePublish';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'postDropToTelegram' BEFORE 'schedulePublish';
  ALTER TABLE "drops" ADD COLUMN "telegram_photo_message_id" numeric;
  ALTER TABLE "drops" ADD COLUMN "telegram_list_message_id" numeric;
  ALTER TABLE "drops" ADD COLUMN "telegram_posted_at" timestamp(3) with time zone;
  ALTER TABLE "site_settings" ADD COLUMN "telegram_channel_url" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'publishDueDrops', 'revalidateDrop', 'pingIndexNow', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'publishDueDrops', 'revalidateDrop', 'pingIndexNow', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  ALTER TABLE "drops" DROP COLUMN "telegram_photo_message_id";
  ALTER TABLE "drops" DROP COLUMN "telegram_list_message_id";
  ALTER TABLE "drops" DROP COLUMN "telegram_posted_at";
  ALTER TABLE "site_settings" DROP COLUMN "telegram_channel_url";`)
}
