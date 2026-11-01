// Зөвшөөрөгдсөн frontend хаягууд: CORS болон cookie-тэй POST хүсэлтийн шалгалтад ашиглана.
// CORS_ORIGINS="https://www.mci.mn,https://mci.mn" — таслалаар тусгаарлана. Хоосон бол dev хаягууд л зөвшөөрөгдөнө.
// CORS_ORIGIN_REGEX="^https://mci-[a-z0-9-]+-mciweb\.vercel\.app$" — Vercel Preview хаягуудыг зөвшөөрөхөд.
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'];

export function originMatcher(env = process.env) {
  const allowed = (env.CORS_ORIGINS || DEFAULT_ORIGINS.join(',')).split(',').map((o) => o.trim()).filter(Boolean);
  const pattern = env.CORS_ORIGIN_REGEX?.trim();
  const regex = pattern ? new RegExp(pattern) : null;
  return (origin) => Boolean(origin) && (allowed.includes(origin) || Boolean(regex?.test(origin)));
}
