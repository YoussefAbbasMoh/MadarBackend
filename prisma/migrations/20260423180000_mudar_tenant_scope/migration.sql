-- MUDAR: tenant denormalization, classroom `kind`, composite user email/phone per tenant.
-- Safe to apply once on an existing LMS PostgreSQL database.

ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'classroom';

ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "SubLesson" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Progress" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "LiveSession" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "AgentSession" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "CourseEnrollment" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "CourseAssistant" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "UserAssignedCourse" ADD COLUMN IF NOT EXISTS "tenantId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Lesson_tenantId_fkey'
  ) THEN
    ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SubLesson_tenantId_fkey') THEN
    ALTER TABLE "SubLesson" ADD CONSTRAINT "SubLesson_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Assessment_tenantId_fkey') THEN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Submission_tenantId_fkey') THEN
    ALTER TABLE "Submission" ADD CONSTRAINT "Submission_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Progress_tenantId_fkey') THEN
    ALTER TABLE "Progress" ADD CONSTRAINT "Progress_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_tenantId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_tenantId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LiveSession_tenantId_fkey') THEN
    ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_tenantId_fkey') THEN
    ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Package_tenantId_fkey') THEN
    ALTER TABLE "Package" ADD CONSTRAINT "Package_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoCode_tenantId_fkey') THEN
    ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentSession_tenantId_fkey') THEN
    ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseEnrollment_tenantId_fkey') THEN
    ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseAssistant_tenantId_fkey') THEN
    ALTER TABLE "CourseAssistant" ADD CONSTRAINT "CourseAssistant_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserAssignedCourse_tenantId_fkey') THEN
    ALTER TABLE "UserAssignedCourse" ADD CONSTRAINT "UserAssignedCourse_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "Lesson" l SET "tenantId" = c."tenantId" FROM "Course" c WHERE l."courseId" = c."id" AND l."tenantId" IS NULL;
UPDATE "SubLesson" s SET "tenantId" = c."tenantId" FROM "Course" c WHERE s."courseId" = c."id" AND s."tenantId" IS NULL;
UPDATE "Assessment" a SET "tenantId" = c."tenantId" FROM "Course" c WHERE a."courseId" = c."id" AND a."tenantId" IS NULL;
UPDATE "Submission" s SET "tenantId" = c."tenantId" FROM "Course" c WHERE s."courseId" = c."id" AND s."tenantId" IS NULL;
UPDATE "Progress" p SET "tenantId" = c."tenantId" FROM "Course" c WHERE p."courseId" = c."id" AND p."tenantId" IS NULL;
UPDATE "Message" m SET "tenantId" = c."tenantId" FROM "Course" c WHERE m."courseId" = c."id" AND m."tenantId" IS NULL;
UPDATE "LiveSession" ls SET "tenantId" = c."tenantId" FROM "Course" c WHERE ls."courseId" = c."id" AND ls."tenantId" IS NULL;
UPDATE "CourseEnrollment" ce SET "tenantId" = c."tenantId" FROM "Course" c WHERE ce."courseId" = c."id" AND ce."tenantId" IS NULL;
UPDATE "CourseAssistant" ca SET "tenantId" = c."tenantId" FROM "Course" c WHERE ca."courseId" = c."id" AND ca."tenantId" IS NULL;
UPDATE "UserAssignedCourse" uac SET "tenantId" = c."tenantId" FROM "Course" c WHERE uac."courseId" = c."id" AND uac."tenantId" IS NULL;
UPDATE "Notification" n SET "tenantId" = u."tenantId" FROM "User" u WHERE n."userId" = u."id" AND n."tenantId" IS NULL;
UPDATE "Transaction" t SET "tenantId" = c."tenantId" FROM "Course" c WHERE t."courseId" IS NOT NULL AND t."courseId" = c."id" AND t."tenantId" IS NULL;
UPDATE "Transaction" t SET "tenantId" = u."tenantId" FROM "User" u WHERE t."tenantId" IS NULL AND t."studentId" = u."id";
UPDATE "AgentSession" a SET "tenantId" = u."tenantId" FROM "User" u WHERE a."studentId" = u."id" AND a."tenantId" IS NULL;

ALTER TABLE "Course" ALTER COLUMN "kind" SET DEFAULT 'classroom';

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_phone_key";

DROP INDEX IF EXISTS "User_tenantId_email_key";
DROP INDEX IF EXISTS "User_tenantId_phone_key";
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE UNIQUE INDEX "User_tenantId_phone_key" ON "User"("tenantId", "phone");

ALTER TABLE "PromoCode" DROP CONSTRAINT IF EXISTS "PromoCode_code_key";
DROP INDEX IF EXISTS "PromoCode_tenantId_code_key";
CREATE UNIQUE INDEX "PromoCode_tenantId_code_key" ON "PromoCode"("tenantId", "code");
