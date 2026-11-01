-- Сайтын сагс/захиалга ба хичээл үзэх эрх (frontend docs/COURSE-CHECKOUT.md)

-- CreateTable
CREATE TABLE "course_orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'MNT',
    "status" TEXT NOT NULL,
    "reported_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "paid_by" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_access" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL,
    "access_type" TEXT,
    "order_id" TEXT,
    "grant_key" TEXT NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_orders_user_id_created_at_idx" ON "course_orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "course_orders_status_idx" ON "course_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "course_access_grant_key_key" ON "course_access"("grant_key");

-- CreateIndex
CREATE INDEX "course_access_user_id_course_id_idx" ON "course_access"("user_id", "course_id");

-- AddForeignKey
ALTER TABLE "course_access" ADD CONSTRAINT "course_access_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "course_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backend-ээр л хандана, Supabase-ийн нийтийн Data API-аас хаалттай.
ALTER TABLE "course_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_access" ENABLE ROW LEVEL SECURITY;

-- Бүх курсын үнэ 49,900₮ (frontend-ийн COURSE_PRICE). Админаас тусгайлан үнэ тавьсан курст хүрэхгүй.
UPDATE "courses" SET "price" = 49900 WHERE "price" IS NULL;
