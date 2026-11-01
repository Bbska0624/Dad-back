# Admin dashboard

The dashboard uses Supabase Auth for login and the Dad-back API for all
protected operations. The backend verifies bearer tokens and checks
`app_metadata.role=admin`; browser storage or user-editable metadata does not
grant administrator access.

## Features

- Overview metrics and enrollment activity.
- Create, edit, duplicate, publish, archive, soft-delete, and restore courses
  and news.
- Review enrollments and orders, update their status, and soft-delete or
  restore records.
- Search and edit profile name, phone, and learning goal. Admin role and
  passwords are not editable here.
- Export filtered lists to CSV and review the latest activity entries.
- Upload PNG, JPEG, WEBP, or GIF images up to 1 MB through the backend.

## Backend routes

The UI consumes the protected endpoints documented in `../SUPABASE.md`:
`/admin/courses`, `/admin/news`, `/admin/records`, `/admin/users`,
`/admin/activity`, and `/admin/images`. Profile and record views use
`/account/me` and `/account/records`.

## Local setup

Follow `../README.md` and `../SUPABASE.md` to configure the backend, Supabase
Auth, database, and administrator role before using dashboard features.
