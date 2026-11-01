-- AlterTable
ALTER TABLE "course_orders" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'course',
ADD COLUMN     "method" TEXT,
ADD COLUMN     "qpay_invoice" JSONB,
ADD COLUMN     "qpay_invoice_id" TEXT;

-- CreateTable
CREATE TABLE "wallets" (
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "wallet_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_ledger_key_key" ON "wallet_ledger"("key");

-- CreateIndex
CREATE INDEX "wallet_ledger_user_id_created_at_idx" ON "wallet_ledger"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "course_orders_qpay_invoice_id_key" ON "course_orders"("qpay_invoice_id");


-- Хэтэвчийн үлдэгдэл хасах утгатай болж болохгүй.
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_non_negative" CHECK ("balance" >= 0);

-- Ledger append-only: засах, устгахыг өгөгдлийн сангийн түвшинд хориглоно.
CREATE FUNCTION "wallet_ledger_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'wallet_ledger is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "wallet_ledger_no_change" BEFORE UPDATE OR DELETE ON "wallet_ledger"
  FOR EACH ROW EXECUTE FUNCTION "wallet_ledger_append_only"();

-- Supabase-ийн public schema: зөвхөн backend (table owner) хандана.
ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet_ledger" ENABLE ROW LEVEL SECURITY;
