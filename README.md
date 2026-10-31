# Magic Code AI backend (mci-backend)

Frontend (`Dad`, mci.mn) -ийн `docs/API.md` гэрээг яг дагасан backend. **Бэлэн:** сургалт, мэдээний API (1-р шат), чатбот `POST /api/chat` (3-р шат), бүртгэл + төлбөр (5-р шат).

Өгөгдөл PostgreSQL-д (Prisma) хадгалагдана (4-р шат). `DATABASE_URL` тохируулаагүй бол санах ойд ажиллана (тест, туршилтад).
Өгөгдлийн сан, QPay одоогоор холбогдоогүй: өгөгдөл нь frontend-ийн mock-оос хуулсан `src/data/*.json`.

## Endpoint-ууд

| Method | Path | Тайлбар |
| --- | --- | --- |
| GET | `/api/health` | `{ "status": "ok" }` |
| GET | `/api/courses?category=Data` | Бүх курс (category заавал биш) |
| GET | `/api/courses/:id` | Нэг курс, эсвэл 404 `not_found` |
| GET | `/api/news?limit=3` | Мэдээний жагсаалт (body, details, gallery-гүй) |
| GET | `/api/news/:id` | Мэдээний дэлгэрэнгүй, эсвэл 404 `not_found` |
| POST | `/api/enrollments` | `{ courseId, name, email, phone }` → 201 `{ id, courseId, status, createdAt }` |
| POST | `/api/payments` | `{ enrollmentId, method: "bank" \| "qpay" }` → 201 төлбөр. Bank бол дансны заавар, QPay одоогоор `instructions: null` |
| GET | `/api/payments/:id` | Төлбөрийн төлөв |
| POST | `/api/chat` | `{ message, lang, history }` → `{ reply }` (Gemini, IP тус бүр минутад 10) |

Алдаа бүр `{ "error": { "code", "message", "fields"? } }` хэлбэртэй (API.md-ийн дагуу).

## Локалаар ажиллуулах

```bash
npm install
cp .env.example .env     # шаардлагатай бол CORS_ORIGINS засна
npm run dev              # http://localhost:4000/api
npm test                 # 29 тест, санах ой дээр (Gemini-г жинхэнээр дууддаггүй)
```

Node.js 20.12+ хэрэгтэй. `npm run dev` нь `.env` файлыг автоматаар уншина.

## Өгөгдлийн сан (PostgreSQL)

Анх удаа (эсвэл шинэ migration ирсэн үед):

```
npm install              # Prisma client-ийг үүсгэнэ
npm run db:deploy        # хүснэгтүүдийг үүсгэнэ (prisma/migrations)
npm run db:seed          # курс, мэдээг src/data/*.json-оос оруулна
npm run dev
```

- `.env` дотор: `DATABASE_URL="postgresql://postgres:НУУЦ_ҮГ@localhost:5432/mci?schema=public"`
- `npm run db:studio` нь хүснэгтүүдийг браузерт харуулна (pgAdmin-аас ч харж болно).
- `db:seed`-ийг дахин ажиллуулахад аюулгүй: курс, мэдээг шинэчилнэ, бүртгэл, төлбөрт хүрэхгүй.
- Схем өөрчлөх үед: `prisma/schema.prisma` засаад `npm run db:migrate`.

**Тестийг DB дээр ажиллуулах (заавал биш):** тусдаа хоосон `mci_test` DB үүсгээд:

```
set DATABASE_URL=postgresql://postgres:НУУЦ_ҮГ@localhost:5432/mci_test
npx prisma migrate deploy
set TEST_DATABASE_URL=%DATABASE_URL%
npm test                 # 30 тест: бүртгэл/төлбөр + DB-ийн хариу mock-той ижил эсэх
```

## Чатботыг шалгах

1. `.env` дотор `GEMINI_API_KEY=...` бичнэ (шинэ key ашиглах нь зүйтэй).
2. `npm run dev`
3. Өөр PowerShell цонхонд:

```powershell
$body = @{ message = "Ямар сургалтууд байна?"; lang = "mn"; history = @() } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/chat -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
```

`reply` талбарт Gemini-ийн хариу гарна. Key байхгүй бол `configuration_error` буцаана.

## Бүртгэл, төлбөрийг шалгах

`npm run dev` асаалттай үед өөр PowerShell цонхонд:

```powershell
$enr = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/enrollments -ContentType "application/json" -Body '{"courseId":"data-analysis","name":"Test","email":"test@example.com","phone":"99112233"}'
$enr
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/payments -ContentType "application/json" -Body (@{ enrollmentId = $enr.id; method = "bank" } | ConvertTo-Json)
```

Банкны заавар харагдуулахын тулд `.env` дотор `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME`-ийг бөглөнө.

## Frontend-ийн өгөгдөл шинэчлэгдвэл

```bash
npm run sync:frontend    # ../Dad-ийн mock өгөгдөл, чатын prompt -> src/data/*.json
```

Frontend-ийн файлуудыг зөвхөн уншина, өөрчлөхгүй.

## Vercel дээр deploy хийх (өөрөө)

1. Энэ folder-ийг GitHub repo руу push хийнэ.
2. Vercel → New Project → repo-гоо сонгоно. Framework Preset: **Other**. Build command хоосон байж болно.
3. Environment Variables: `DATABASE_URL` (онлайн Postgres, жишээ нь Neon), `CORS_ORIGINS=https://www.mci.mn,https://mci.mn`, `GEMINI_API_KEY=...`, `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME`
   Онлайн DB дээр нэг удаа: `DATABASE_URL=<онлайн> npm run db:deploy` болон `npm run db:seed`.
4. Deploy хийсний дараа `https://<таны-домэйн>/api/health` нь `{"status":"ok"}` буцаах ёстой.

`vercel.json` бүх хүсэлтийг `api/index.js` (Express app) руу чиглүүлнэ.

## Frontend-ийг холбох (дараа нь, таны зөвшөөрлөөр)

Frontend-ийн `.env` дотор: `VITE_USE_MOCK=false`, `VITE_API_URL=https://<backend-домэйн>/api`.
Холбохоос өмнө backend нь онлайн DB-тэй Vercel дээр ажиллаж байх ёстой (2-р шат).

## Хавтасны бүтэц

```
api/index.js            Vercel-ийн entry
src/app.js              Express app, CORS, route-ууд
src/server.js           Локал сервер (PORT=4000)
src/routes/             courses.js, news.js, chat.js, enrollments.js, payments.js
src/services/gemini.js  Gemini дуудлага
src/middleware/         rateLimit.js
src/env.js              Локал .env уншигч
src/store.js            Өгөгдлийн давхарга: DATABASE_URL байвал Postgres, үгүй бол санах ой
src/store/prisma.js     PostgreSQL (Prisma)
src/store/memory.js     Санах ой (тест)
prisma/schema.prisma    Хүснэгтийн схем
prisma/migrations/      SQL migration-ууд
prisma/seed.js          Курс, мэдээ оруулах
src/errors.js           API.md-ийн алдааны формат
src/data/               Frontend mock-оос хуулсан JSON
scripts/sync-from-frontend.mjs
test/api.test.js
```
