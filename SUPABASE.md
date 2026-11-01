# Supabase тохиргоо

Frontend нь Supabase Auth-аар нэвтэрч, access token-оо Dad-back API руу илгээнэ. Backend токеныг Supabase дээр шалгаад зөвхөн app_metadata.role=admin хэрэглэгчид админ API-г нээнэ. Browser-ийн demo session админ эрх өгөхгүй.

## Локал тохиргоо

Dad-back/.env: DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_STORAGE_BUCKET.
mci-web/.env.local: VITE_USE_MOCK=false, VITE_API_URL=/api, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY.
Admin frontend-ийн local тохиргоо: `frontend/.env.local` дотор `VITE_USE_MOCK=false`, `VITE_API_URL=/api`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Supabase Auth-ийн Redirect URLs жагсаалтад `http://127.0.0.1:5173/**` нэмнэ.
Нууц database URL болон secret key зөвхөн backend-д хадгалагдана.

1. Dad-back дотор npm run db:deploy: schema migration-уудыг ажиллуулна.
2. npm run db:import-site: эхний сургалт, мэдээ болон тэдгээрийн зургуудыг Supabase-д оруулна. Админаар зассан мөрүүдийг өөрчлөхгүй; анхны мөрүүдийн зургуудыг Storage руу шилжүүлж, нүүр хуудсын тохиргоог нөхнө. site-images public bucket байхгүй бол үүсгэнэ. Upload эрх зөвхөн серверт байна.
3. Supabase Dashboard → Authentication → Users → Add user хэсгээс админ хэрэглэгч үүсгэнэ. Админ frontend-д бүртгүүлэх хуудас байхгүй.
4. `node scripts/set-admin.mjs admin@example.com` ажиллуулж баталгаажсан бүртгэлд admin эрх өгнө. Supabase Auth хэрэглэгчийн app_metadata.role талбарт admin эрхийг зөвхөн итгэмжлэгдсэн серверийн admin API-аар тохируулна. user_metadata.role ашиглахгүй.
5. Backend болон frontend-ийг дахин асаана.

## API

Public: GET /api/courses, /api/courses/:id, /api/news, /api/news/:id. Зөвхөн publication=published, deletedAt=null мөр буцаана.
Админ: GET/POST /api/admin/courses, /api/admin/news; PUT /api/admin/:type/:id; POST /api/admin/:type/:id/:action. action: published, draft, archived, delete, restore.
GET /api/admin/activity: сүүлийн 150 өөрчлөлт.
GET /api/admin/users; PUT /api/admin/users/:id: нэр, утас, зорилго засах; эрх болон нууц үг өөрчлөхгүй.
GET /api/admin/records; POST /api/admin/records/:id/:action: new, done, cancelled, delete, restore.
POST /api/admin/images: { dataUrl }, PNG/JPEG/WEBP/GIF, 1 MB хүртэл. Supabase Storage URL буцаана.
GET/PUT /api/account/me: өөрийн profile.
GET /api/account/records: өөрийн элсэлт/захиалга.
POST /api/account/records: {type: order, items: string[]} захиалгын хүсэлт. Бодит төлбөр/барааны үнийн тооцоо хийхгүй.
POST /api/enrollments: сургалтын бүртгэл; authenticated бол userId, email-ийг баталгаажсан session-оос авна.

## Сайтын нэвтрэлт ба сургалтын захиалга (mci.mn)

Сайт `mci.mn/api/*`-г Vercel proxy-оор энэ backend руу дамжуулдаг тул session cookie нь mci.mn домэйн дээр хадгалагдана.

- POST /api/auth/register {name, email, password}: имэйл баталгаажуулалт асаалттай бол 202 {confirmationRequired, email}; унтраалттай бол 201 profile + cookie. Бүртгэлтэй имэйл бол 409 duplicate.
- POST /api/auth/login {email, password}: profile + cookie. Буруу бол 401 invalid_credentials, баталгаажаагүй бол 403 email_not_confirmed.
- GET /api/auth/me: {id, name, email, role} эсвэл 401. Access токены хугацаа дуусвал refresh токеноор автоматаар сэргээнэ.
- POST /api/auth/logout: 204, cookie устгана.
- GET /api/auth/confirm?token_hash=&type=email: имэйл дэх линк. Баталгаажуулаад нэвтрүүлж /account руу шилжүүлнэ.
- POST /api/orders {courseIds}; GET /api/me/orders; POST /api/orders/:id/bank-transfer; POST /api/orders/:id/qpay (QPay холбогдох хүртэл 503 qpay_unavailable).
- GET /api/me/courses: идэвхтэй эрхүүд. Power BI (data-analysis) курсын 3 сарын түр эрхийг хэрэглэгч бүрт нэг удаа олгоно.
- GET /api/me/courses/:courseId/lessons: зөвхөн эрхтэй үед, эс бөгөөс 403 payment_required.
- GET /api/admin/course-orders; POST /api/admin/course-orders/:id/paid|cancelled: админ шилжүүлгийг шалгаад батлахад эрх 3 сараар нээгдэнэ; төлөгдсөн захиалгыг цуцлахад эрх хаагдана. Админ самбарын "Сургалтын төлбөр" таб.

- GET /api/me/wallet: үлдэгдэл, гүйлгээ, нээлттэй цэнэглэлт. POST /api/me/wallet/topups {amount}: цэнэглэлтийн захиалга (`kind: topup`), цааш bank-transfer эсвэл qpay-ээр төлнө.
- POST /api/orders/:id/wallet: хэтэвчээс шууд төлнө, үлдэгдэл хүрэхгүй бол 409 insufficient_balance.
- POST /api/orders/:id/qpay, /qpay/check; GET|POST /api/qpay/callback: `QPAY_*` тохируулсны дараа идэвхжинэ. Callback-ийн агуулгад итгэхгүй, гарын үсгийг шалгаад төлбөрийг QPay-ээс асууна.

Cookie: `mci_at`, `mci_rt` — HttpOnly, SameSite=Lax, Path=/api, production-д Secure. Cookie-тэй POST хүсэлтийн Origin нь CORS_ORIGINS / CORS_ORIGIN_REGEX-д байх ёстой.

Supabase Dashboard тохиргоо (нэг удаа):

1. Authentication → Sign In / Providers → Email: **Confirm email** асаалттай.
2. Authentication → URL Configuration: **Site URL** = `https://www.mci.mn`.
3. Authentication → Emails → **Confirm signup** загварын линкийг дараахаар солино:
   `<a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=email">Баталгаажуулах</a>`
4. Supabase-ийн үнэгүй имэйл илгээлт цагт цөөн имэйлээр хязгаарлагдана. Хэрэглэгч олширвол Authentication → Emails → SMTP Settings-д тусдаа имэйл сервис холбоно.

Backend env: `SITE_URL` (заавал биш, анхдагч `https://www.mci.mn`).

## Хамгаалалт

Database хүснэгтүүд RLS-тай, browser-оос Data API-аар шууд хандах policy байхгүй. PostgreSQL холболттой backend эрх, нийтлэлийн төлөв, оролтыг шалгана. Сургалт/мэдээ хадгалах болон үйлдлийн түүх нэг transaction-д бичигдэнэ. Устгал soft delete тул сэргээж болно. Production-д DATABASE_URL байхгүй бол түр санах ой руу шилжихгүй.

## Vercel

Хоёр project: mci-web болон Dad-back. Frontend VITE_API_URL=https://BACKEND_DOMAIN/api. Backend CORS_ORIGINS-д frontend домэйныг оруулна. Backend DATABASE_URL-д transaction pooler (6543, pgbouncer=true&connection_limit=1), DIRECT_URL-д session pooler (5432) эсвэл direct URL ашиглана. Browser-д зөвхөн public key байршуулна. API key болон DB URL-ийг git-д оруулахгүй.

## Одоогоор тусдаа үлдсэн хэсгүүд

Хичээлийн видео, суралцах явц болон дэлгүүрийн бүтээгдэхүүний каталог frontend дээрээ хэвээр. Нүүр хуудасны тогтмол танилцуулга, лого мөн frontend asset хэвээр. Chatbot-д GEMINI_API_KEY, банкны зааварт BANK_* тохиргоо шаардлагатай. QPay болон төлбөрийн автомат баталгаажуулалт хэрэгжээгүй.

## Шалгалт

`npm test` нь API, эрхийн шалгалт болон оролтын тестүүд. `node scripts/verify-cloud.mjs` нь тохируулсан database дээр админы CRUD, нийтлэл, profile, элсэлт/захиалгыг шалгана; бүх түр өгөгдөл нэг transaction-д орж эцэст нь rollback хийгдэнэ. Серверийн жинхэнэ Auth шалгалтыг энэ тусдаа процессын тестэд injected verifier-ээр орлуулдаг; production серверт тестийн нэвтрэх зам нэмдэггүй.

## Өгөгдлийн сангийн бүтэц

Prisma-гийн гаднах `kb_sources`, `kb_chunks`, `kb_rate_limits` хүснэгтүүд, `kb_match_chunks`, `kb_rate_limit_hit` функцууд чатботын мэдлэгийн санд ашиглагддаг. Тэдгээрийн бүтцийн хуулбар: `prisma/external/kb_schema.sql`.

Энэ санд `prisma migrate dev`, `prisma migrate reset`, `prisma db push` ажиллуулж болохгүй: `kb_*` хүснэгтүүдийг устгаж эсвэл бүх өгөгдлийг цэвэрлэж мэднэ. Ажиллаж буй санд зөвхөн `npm run db:deploy` хэрэглэнэ.

`20261031120000_security_limits` migration файлыг санд бичигдсэн бүтцээс сэргээсэн тул checksum нь анхны файлаас ялгаатай байж болно.
