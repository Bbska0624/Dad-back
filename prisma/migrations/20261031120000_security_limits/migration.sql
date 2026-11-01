-- DropIndex
DROP INDEX "enrollments_course_id_email_normalized_key";

-- CreateTable
CREATE TABLE "request_limits" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enrollments_course_id_email_normalized_idx" ON "enrollments"("course_id", "email_normalized");

-- CreateIndex
CREATE INDEX "request_limits_expires_at_idx" ON "request_limits"("expires_at");
