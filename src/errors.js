// docs/API.md "Алдааны хариу": { error: { code, message, fields? } }
export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const notFound = (what) => new HttpError(404, 'not_found', `${what} not found`);
export const validationError = (fields) => new HttpError(400, 'validation_error', 'Invalid input', fields);

export function notFoundHandler(req, res, next) {
  next(new HttpError(404, 'not_found', `Route ${req.method} ${req.path} not found`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    const error = { code: err.code, message: err.message };
    if (err.fields) error.fields = err.fields;
    return res.status(err.status).json({ error });
  }
  // Буруу JSON body гэх мэт express-ийн алдаа
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'validation_error', message: 'Invalid JSON body' } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'internal_error', message: 'Internal server error' } });
}
