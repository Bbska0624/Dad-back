CREATE TABLE "services" (
 "id" TEXT NOT NULL PRIMARY KEY, "number" TEXT NOT NULL DEFAULT '01 /',
 "title" JSONB NOT NULL, "text" JSONB NOT NULL, "price" TEXT NOT NULL,
 "features" JSONB NOT NULL, "image" JSONB, "sort_order" INTEGER NOT NULL DEFAULT 0,
 "publication" TEXT NOT NULL DEFAULT 'published', "deleted_at" TIMESTAMP(3),
 "managed" BOOLEAN NOT NULL DEFAULT false,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL
);