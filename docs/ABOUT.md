# About profile management

The admin dashboard's About tab edits the bilingual heading, director name, role,
biography, portrait, languages, statistics, and fact groups. Lists support adding
and removing entries. The visibility checkbox hides the profile without deleting
its saved content; the stories below it remain independent.

Deployment order:

1. Run `npm run db:deploy` to create `site_sections` and enable row-level security.
2. Deploy the backend and admin frontend in this repository.
3. Deploy the public `mci-web` frontend with `VITE_API_URL` pointing to this backend's `/api`.

`npm run db:import-site` optionally imports the initial profile and uploads its
portrait to Supabase Storage. It leaves existing About content untouched.
Until the first save/import, the backend returns `src/data/about.json` as the
initial content. The default portrait is bundled in both frontends.

API:

- `GET /api/site/about`: public content; returns only `{ "visible": false }` when hidden. No cache.
- `GET /api/admin/site/about`: full saved content, including hidden profiles; admin token required.
- `PUT /api/admin/site/about`: validates and replaces the profile; admin token required.

The body follows `src/data/about.json`. Both languages are required for each text
entry. Lists may be empty. Images accept site-relative or HTTP(S) URLs; image
uploads use the existing `/api/admin/images` endpoint. Saves and audit entries
commit in one database transaction.

Row-level security blocks direct access through Supabase's public Data API.
The backend uses its privileged database connection and checks admin permissions
before reading hidden content or saving changes.
