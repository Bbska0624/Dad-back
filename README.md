# Magic Code AI backend (mci-backend)

Frontend (`Dad`, mci.mn) -ийн `docs/API.md` гэрээг яг дагасан backend. **Бэлэн:** сургалт, мэдээний API (1-р шат), чатбот `POST /api/chat` (3-р шат).
Өгөгдлийн сан, QPay одоогоор холбогдоогүй: өгөгдөл нь frontend-ийн mock-оос хуулсан `src/data/*.json`.

## Endpoint-ууд

| Method | Path | Тайлбар |
| --- | --- | --- |
| GET | `/api/health` | `{ "status": "ok" }` |
| GET | `/api/courses?category=Data` | Бүх курс (category заавал биш) |
| GET | `/api/courses/:id` | Нэг курс, эсвэл 404 `not_found` |
| GET | `/api/news?limit=3` | Мэдээний жагсаалт (body, details, gallery-гүй) |
| GET | `/api/news/:id` | Мэдээний дэлгэрэнгүй, эсвэл 404 `not_found` |
| POST | `/api/chat` | `{ message, lang, history }` → `{ reply }` (Gemini, IP тус бүр минутад 10) |

Алдаа бүр `{ "error": { "code", "message", "fields"? } }` хэлбэртэй (API.md-ийн дагуу).

## Локалаар ажиллуулах

```bash
npm install
cp .env.example .env     # шаардлагатай бол CORS_ORIGINS засна
npm run dev              # http://localhost:4000/api
npm test                 # 18 тест (Gemini-г жинхэнээр дууддаггүй)
```

Node.js 20.12+ хэрэгтэй. `npm run dev` нь `.env` файлыг автоматаар уншина.

## Чатботыг шалгах

1. `.env` дотор `GEMINI_API_KEY=...` бичнэ (шинэ key ашиглах нь зүйтэй).
2. `npm run dev`
3. Өөр PowerShell цонхонд:

```powershell
$body = @{ message = "Ямар сургалтууд байна?"; lang = "mn"; history = @() } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/chat -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
```

`reply` талбарт Gemini-ийн хариу гарна. Key байхгүй бол `configuration_error` буцаана.

## Frontend-ийн өгөгдөл шинэчлэгдвэл

```bash
npm run sync:frontend    # ../Dad-ийн mock өгөгдөл, чатын prompt -> src/data/*.json
```

Frontend-ийн файлуудыг зөвхөн уншина, өөрчлөхгүй.

## Vercel дээр deploy хийх (өөрөө)

1. Энэ folder-ийг GitHub repo руу push хийнэ.
2. Vercel → New Project → repo-гоо сонгоно. Framework Preset: **Other**. Build command хоосон байж болно.
3. Environment Variables: `CORS_ORIGINS=https://www.mci.mn,https://mci.mn`, `GEMINI_API_KEY=...`
4. Deploy хийсний дараа `https://<таны-домэйн>/api/health` нь `{"status":"ok"}` буцаах ёстой.

`vercel.json` бүх хүсэлтийг `api/index.js` (Express app) руу чиглүүлнэ.

## Frontend-ийг холбох (дараа нь, таны зөвшөөрлөөр)

Frontend-ийн `.env` дотор: `VITE_USE_MOCK=false`, `VITE_API_URL=https://<backend-домэйн>/api`.
Анхаар: одоогоор зөвхөн courses, news бэлэн. Enrollments, payments дараагийн шатанд нэмэгдэнэ.
Тиймээс бүх зүйл бэлэн болтол frontend-ийг mock горимд үлдээх нь зүйтэй.

## Хавтасны бүтэц

```
api/index.js            Vercel-ийн entry
src/app.js              Express app, CORS, route-ууд
src/server.js           Локал сервер (PORT=4000)
src/routes/             courses.js, news.js, chat.js
src/services/gemini.js  Gemini дуудлага
src/middleware/         rateLimit.js
src/env.js              Локал .env уншигч
src/store.js            Өгөгдлийн давхарга (дараа нь Prisma/PostgreSQL-ээр солино)
src/errors.js           API.md-ийн алдааны формат
src/data/               Frontend mock-оос хуулсан JSON
scripts/sync-from-frontend.mjs
test/api.test.js
```
