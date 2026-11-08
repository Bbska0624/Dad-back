# Хичээлийн видео (Cloudflare R2)

Видеонууд Cloudflare R2-ийн private `mci-videos` bucket-д хадгалагдана (Public Access: Disabled).
Backend хэрэглэгчийн эрхийг шалгаад **2 цагийн хугацаатай линк** (presigned URL) буцаана.
Линкийг `<video src="...">`-д шууд тавьж тоглуулна.

## Файлын бүтэц

```
courses/<courseId>/<lessonId>.mp4      жишээ: courses/course_86a45b6609a5/lesson-01.mp4
```

Хичээлийн жагсаалт, нэр, урт, аль нь нээлттэй танилцуулга вэ гэдэг нь `src/data/videos.json`-д байна.
Шинэ видео нэмэхдээ: R2-д upload хийж, `videos.json`-д мөр нэмээд deploy хийнэ.
Файлыг H.264 MP4, `-movflags +faststart`-тай, 300 MB-аас бага байлгана (dashboard upload-ийн хязгаар).

## API

| Method | Path | Эрх | Хариу |
| --- | --- | --- | --- |
| GET | `/api/courses/:id/preview` | Хэн ч (IP тус бүр минутад 30) | `{ courseId, lesson, url, expiresAt }` — танилцуулга видео |
| GET | `/api/me/courses/:courseId/lessons` | Нэвтэрсэн + төлбөр батлагдсан | `{ lessons: [{ id, mn, en, duration, video: true, preview }] }` (линкгүй) |
| GET | `/api/me/courses/:courseId/lessons/:lessonId/video` | Нэвтэрсэн; `preview` биш бол төлбөр батлагдсан | `{ courseId, lesson, url, expiresAt }` |

Алдаа: `401 unauthorized`, `403 payment_required`, `404 not_found`, `503 video_unavailable` (R2_* тохируулаагүй).
YouTube хичээлүүд (`lessons.json`, `creator` талбартай) өмнөх шигээ ажиллана.

## Тохиргоо

`.env` болон Vercel → Settings → Environment Variables:

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...        # R2 API token: Object Read only, зөвхөн mci-videos
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=mci-videos
```

Эдгээрийг frontend (`VITE_*`) болон git-д хэзээ ч бүү оруул.
Анхаар: хугацаатай линк хүчинтэй байх 2 цагийн дотор хуваалцагдаж болно; дэлгэцийн бичлэгээс хамгаалахгүй.
