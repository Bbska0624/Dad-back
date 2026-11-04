# Bank transfer operations

Customers transfer once to either displayed account and put the exact order ID in the transfer description. Clicking "I transferred" only requests review; it must never unlock lessons or credit a wallet.

An administrator checks the bank's actual incoming transactions, matching the receiving account, exact amount, currency and order reference. A screenshot or customer message is not proof of receipt. Resolve missing references, partial payments and mismatches before marking the order paid. Record the bank transaction ID in your reconciliation log and never use the same transaction for two orders. The current application does not enforce uniqueness of external bank transaction IDs; the reconciliation log is a manual control.

Use the existing admin paid action after checking receipt. Settlement is conditional and repeated approvals cannot grant access or credit the wallet twice. Course checkout reuses identical pending orders and blocks overlapping pending courses and active owned courses. Access expires after three months, after which purchase is allowed again. The site cannot stop somebody making two separate transfers in their banking app; reconcile and refund excess payments manually.

There is currently no dedicated website development/hosting invoice model or checkout. Do not use course orders or wallet top-ups as website invoice records. A website billing flow needs a unique invoice ID, amount, service/billing period, customer and the same manual reconciliation process.

# Signup verification

The existing email/password registration supports Supabase confirmation links. Enable Confirm email and configure the confirmation template and Site URL as described in SUPABASE.md. Configure custom SMTP for public signup: Supabase's default sender is for testing and restricts recipients to project team addresses. Use an SMTP provider within its free allowance if available; check its current limits and domain requirements.

Email confirmation proves access to an inbox, not a person's legal identity or bank account ownership. Google sign-in is another option, but requires OAuth configuration and application integration; it is not currently implemented here. Paid SMS or identity checks are unnecessary for ordinary course signup.
