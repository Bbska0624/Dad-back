# Backend integration

This frontend uses the Dad-back API and Supabase Auth. Copy `.env.example` to
`.env.local`, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`,
then start the backend on port 4000 and run `npm run dev`. Vite proxies `/api`
to the local backend. The browser only receives the Supabase publishable key;
the backend verifies bearer tokens and enforces administrator roles.

The browser demo account and local record stores are not used in live mode.
Admin content, records, users, profile data, and image uploads are persisted
through the authenticated backend endpoints.

Backend/database-ийн код энэ багцад байхгүй. API-ийн гэрээ, local storage түлхүүрүүдийг `docs/ADMIN.md`-ээс үзнэ үү.
