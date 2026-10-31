// Gemini-ээс чатботын хариу авна. Frontend-ийн src/api/chat.js-ийн логиктой ижил.
// API key зөвхөн серверт (GEMINI_API_KEY) хадгалагдана.
import { readFileSync } from 'node:fs';
import { HttpError } from '../errors.js';

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const systemPrompt = JSON.parse(readFileSync(new URL('../data/chat-prompt.json', import.meta.url), 'utf8'));

export async function generateReply({ message, lang, history = [] }, { fetchImpl = fetch, env = process.env } = {}) {
  const apiKey = env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    throw new HttpError(503, 'configuration_error', 'Chat is not configured');
  }

  const historyContents = history.slice(-10).map(({ role, content }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: [{ text: content }],
  }));
  // Gemini нь яриаг user-ээр эхлэхийг шаарддаг: эхний user мессежээс өмнөхийг (мэндчилгээ) хасна.
  const firstUser = historyContents.findIndex(({ role }) => role === 'user');
  const contents = [
    ...(firstUser === -1 ? [] : historyContents.slice(firstUser)),
    { role: 'user', parts: [{ text: message }] },
  ];

  let response;
  try {
    response = await fetchImpl(`${API_URL}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt[lang] }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    console.error('Gemini request failed:', error.message);
    throw new HttpError(502, 'ai_error', 'AI service unreachable');
  }

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    // Key болон Google-ийн дэлгэрэнгүй алдааг хэрэглэгчид харуулахгүй, зөвхөн логт бичнэ.
    console.error(`Gemini error ${response.status}:`, data?.error?.message);
    if (response.status === 429) throw new HttpError(429, 'rate_limited', 'AI quota exceeded');
    if ([400, 401, 403].includes(response.status)) throw new HttpError(503, 'configuration_error', 'Chat is not configured');
    throw new HttpError(502, 'ai_error', 'AI service error');
  }

  const candidate = data?.candidates?.[0];
  const reply = candidate?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!reply) {
    const reason = candidate?.finishReason || data?.promptFeedback?.blockReason || 'empty_response';
    throw new HttpError(502, 'ai_error', `AI returned no text (${reason})`);
  }
  return { reply };
}
