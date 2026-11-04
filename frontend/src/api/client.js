// Бүх API дуудлага энэ файлаар дамжина.
// VITE_USE_MOCK=false болгоход mock-ийн оронд VITE_API_URL руу бодит хүсэлт явна.
// Тохиргоо: .env.example, гэрээ: docs/API.md
import { supabase } from './supabase';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // HTTP статус, сүлжээний алдаа бол 0
    this.code = code; // docs/API.md дахь алдааны код
    this.fields = fields; // validation_error үед: { email: '...' }
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string} path  '/courses' гэх мэт, BASE_URL-ийн араас залгагдана
 * @param {object} options
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} [options.method]
 * @param {object} [options.body]  JSON болгон илгээнэ
 * @param {AbortSignal} [options.signal]
 * @param {() => any} options.mock  Mock горимд дуудагдах функц (ApiError шидэж болно)
 */
export async function request(path, { method = 'GET', body, signal, mock, token } = {}) {
  if (USE_MOCK) {
    // Бодит сүлжээ шиг бага зэрэг хүлээлгэж, ачааллах төлөвийг харагдуулна.
    await wait(300 + Math.random() * 300);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return structuredClone(await mock());
  }

  let res;
  try {
    let accessToken = token;
    if (accessToken === undefined && supabase) {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      accessToken = data.session?.access_token;
    }
    res = await fetch(BASE_URL + path, {
      method,
      signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'network_error', 'Network request failed');
  }

  if (res.status === 204) return null;
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  const data = isJson ? await res.json().catch(() => undefined) : undefined;
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? 'http_error', e?.message ?? `HTTP ${res.status}`, e?.fields);
  }
  // Буруу хаяг руу хандвал JSON биш (жишээ нь index.html) ирж болно.
  if (data === undefined) throw new ApiError(res.status, 'invalid_response', 'Expected a JSON response');
  return data;
}

const MESSAGES = {
  same_password: ['Өмнөхөөсөө өөр нууц үг сонгоно уу.', 'Choose a password different from your current password.'],
  session_not_found: ['Сэргээх холбоос хүчингүй болсон. Шинэ холбоос авна уу.', 'Your reset session has expired. Request a new reset link.'],
  server_unavailable: ['Админ сервертэй холбогдож чадсангүй. Түр хүлээгээд дахин оролдоно уу.', 'The admin server is unavailable. Please wait and try again.'],
  unauthorized: ['Нэвтрэх эрх хүчингүй болсон байна. Дахин нэвтэрнэ үү.', 'Your session has expired. Please log in again.'],
  auth_unavailable: ['Нэвтрэлтийн үйлчилгээтэй холбогдож чадсангүй.', 'Could not reach the authentication service.'],
  invalid_credentials: ['Имэйл эсвэл нууц үг буруу байна.', 'Incorrect email or password.'],
  email_not_confirmed: ['Нэвтрэхийн өмнө имэйлээ баталгаажуулна уу.', 'Confirm your email before logging in.'],
  login: ['Имэйл эсвэл нууц үг буруу байна.', 'Incorrect email or password.'],
  mismatch: ['Нууц үгүүд таарахгүй байна.', 'The passwords do not match.'],
  duplicate: ['Энэ имэйл бүртгэлтэй байна. Нэвтрэх хэсгээр орно уу.', 'This email is already registered. Please log in.'],
  forbidden: ['Энэ үйлдэлд админ эрх шаардлагатай.', 'Administrator access is required.'],
  storage_error: ['Зургийг Supabase Storage-д хадгалж чадсангүй.', 'Could not save the image to Supabase Storage.'],
  weak_password: ['Нууц үг шаардлага хангахгүй байна.', 'The password does not meet the requirements.'],
  corrupt_storage: ['Хадгалсан мэдээллийг уншиж чадсангүй. Өмнөх мэдээллийг дарж бичээгүй.', 'Saved data could not be read. Existing data has not been overwritten.'],
  body_required: ['Нийтлэхийн өмнө мэдээний дэлгэрэнгүйг хоёр хэлээр оруулна уу.', 'Add the story body in both languages before publishing.'],
  invalid_image: ['Зургийн зөв холбоос эсвэл зураг файл сонгоно уу.', 'Choose a valid image URL or image file.'],
  validation_error: ['Мэдээллээ шалгаад дахин оролдоно уу.', 'Please check your details and try again.'],
  not_found: ['Хайсан зүйл олдсонгүй.', 'We could not find what you were looking for.'],
  enrollment_closed: ['Энэ сургалтын бүртгэл одоогоор хаалттай байна.', 'Enrollment for this course is currently closed.'],
  already_enrolled: ['Та энэ сургалтад аль хэдийн бүртгүүлсэн байна.', 'You are already enrolled in this course.'],
  network_error: ['Сервертэй холбогдож чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.', 'Could not reach the server. Check your connection and try again.'],
  configuration_error: ['Supabase эсвэл backend тохиргоо дутуу байна. frontend/.env.local файлаа шалгана уу.', 'Supabase or backend configuration is missing. Check frontend/.env.local.'],
  rate_limited: ['Хэт олон хүсэлт явсан байна. Түр хүлээгээд дахин оролдоно уу.', 'Too many requests. Please wait and try again.'],
  ai_error: ['Gemini хариу өгөхөөс татгалзлаа. Асуултаа өөрөөр бичиж дахин оролдоно уу.', 'Gemini did not return text. Try rephrasing your question.'],
};
const FALLBACK = ['Алдаа гарлаа. Дахин оролдоно уу.', 'Something went wrong. Please try again.'];

/** Алдааны кодыг хэрэглэгчид харуулах текст болгоно. `t` нь useLang()-ийн t. */
export function errorMessage(error, t) {
  const [mn, en] = MESSAGES[error?.code] ?? FALLBACK;
  return t(mn, en);
}
