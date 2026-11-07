# Course payment and contact options

All published courses can be added to the cart. Existing learning access is unchanged.

- Computer organization and architecture (Компьютер зохион байгуулалт, архитектур) and Python (python-programming) use normal checkout by default: bank details, transfer review requests and admin payment confirmation.
- The other eight courses show a call button for 94140478 in the cart. They are excluded from the checkout amount and order items, including in mixed carts.
- Admin → Courses → Edit → Онлайнаар төлбөр төлөх боломжтой controls online payment eligibility, not the ability to add to cart.
- Settings use onlinePaymentEnabled in existing site_sections records keyed course-commerce:<id>. Old cartEnabled overrides are ignored. No database migration is required.
- Public course responses expose cartEnabled: true and onlinePaymentEnabled. New checkout requests containing contact-only courses are rejected server-side.
- Global phone-only mode is off by default. Existing order history and payment processing remain intact. PHONE_ONLY_ORDERING=true is an optional emergency override; it is not required for this configuration.
- Deploy both repositories together so the restored frontend checkout reaches the updated backend.
