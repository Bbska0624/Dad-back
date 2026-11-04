// Public receiving accounts. Account holder names must match the bank records.
export function bankAccounts(env = process.env) {
  return [
    { bankName: 'Хаан банк', accountNumber: 'MN790005005031346583', accountName: env.BANK_ACCOUNT_NAME || 'Энхтуяа Цогтбаатар' },
    { bankName: 'Худалдаа хөгжлийн банк', accountNumber: 'MN570004004004201904', accountName: env.TDB_ACCOUNT_NAME || 'МЭЖИК КОД ЭЙ АЙ ХХК' },
  ];
}
