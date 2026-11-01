# Magic Code AI frontend

This React/Vite app provides the administrator login and dashboard UI for
the Dad-back API in the repository root.

## Run locally

1. Configure the backend environment as described in `../SUPABASE.md`.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` from the Supabase project.
3. In the repository root, start the API with `npm run dev`.
4. In this directory, install dependencies and start the frontend:

   ```sh
   npm ci
   npm run dev
   ```

5. Open `http://127.0.0.1:5173/login`. The Vite server proxies `/api` to
   `http://127.0.0.1:4000`.

There is no demo administrator login. Register with Supabase, confirm the
email, and grant admin access through the trusted backend script described in
`../SUPABASE.md`. Only Supabase's publishable key belongs in frontend
configuration; never put the secret key or database URLs in `VITE_` variables.

## Validate

```sh
npm run build
npm test
```

`VITE_USE_MOCK=false` is the default. Authentication, profiles, admin content,
records, users, and image uploads use the backend API.

This admin-only app has no registration page. Non-admin users can sign out and use another account.
