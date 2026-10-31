// Локал хөгжүүлэлтэд .env файлыг уншина (Node 20.12+). Vercel дээр .env байхгүй, тохиргоо нь dashboard-оос ирнэ.
try {
  process.loadEnvFile();
} catch {
  /* .env байхгүй бол алгасна */
}
