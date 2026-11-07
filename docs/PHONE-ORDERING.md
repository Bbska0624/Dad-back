# Temporary phone ordering

- Only the course titled `Компьютер зохион байгуулалт, архитектур` allows adding to cart by default. All other courses default to paused.
- Admin → Courses → Edit → **Сагслах боломж нээлттэй** → Save overrides the default for that course. This does not revoke existing learning access or change publication/enrollment status.
- Overrides are stored by course ID in the existing `site_sections` table (`course-commerce:<id>`). No schema migration or destructive data update is required.
- Public course responses include `cartEnabled`; the frontend refreshes the catalog on window focus or page reload.
- Phone-only ordering blocks new online orders, enrollments, top-ups and payment initiation. Existing order history, lesson access, admin settlement and QPay reconciliation remain available. Bank details are omitted from order, wallet and legacy payment responses.
- Deploy both the backend/admin repository and the website repository. Local edits do not change the Vercel sites until deployed.
- To restore online checkout later, set backend `PHONE_ONLY_ORDERING=false`, change frontend `PHONE_ONLY_ORDERING` in `src/data/ordering.js` to `false`, and deploy both. Course cart switches still apply.
- The order phone number is configured in frontend `src/data/ordering.js` as `ORDER_PHONE`.
