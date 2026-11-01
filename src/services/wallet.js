// Дотоод хэтэвч. Үлдэгдэл хөдлөх бүр нэг transaction дотор ledger-т бичигдэнэ (tx нь Prisma-ийн transaction).
import { HttpError } from '../errors.js';
import { newId } from '../store.js';

/** delta > 0 орлого, delta < 0 зарлага. ledger.key нь нэг захиалгыг давхар бичихээс хамгаална. */
export async function moveWallet(tx, { userId, delta, type, orderId, now = new Date() }) {
  if (delta > 0) {
    await tx.wallet.upsert({ where: { userId }, create: { userId, balance: delta }, update: { balance: { increment: delta } } });
  } else {
    const debited = await tx.wallet.updateMany({ where: { userId, balance: { gte: -delta } }, data: { balance: { decrement: -delta } } });
    if (!debited.count) throw new HttpError(409, 'insufficient_balance', 'Wallet balance is too low');
  }
  const { balance } = await tx.wallet.findUniqueOrThrow({ where: { userId } });
  await tx.walletLedger.create({ data: {
    id: newId('wtx'), userId, amount: delta, balanceAfter: balance, type, orderId, key: `${type}:${orderId}`, createdAt: now,
  } });
  return balance;
}

export async function walletSummary(db, userId) {
  const [wallet, rows] = await Promise.all([
    db.wallet.findUnique({ where: { userId } }),
    db.walletLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
  ]);
  return {
    balance: wallet?.balance ?? 0,
    currency: 'MNT',
    transactions: rows.map(({ id, amount, balanceAfter, type, orderId, createdAt }) => ({
      id, amount, balanceAfter, type, orderId, createdAt: createdAt.toISOString(),
    })),
  };
}
