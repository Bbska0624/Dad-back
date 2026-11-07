import { HttpError } from '../errors.js';

export const phoneOnlyOrdering = (env = process.env) => env.PHONE_ONLY_ORDERING === 'true';

// Leave existing order history, admin confirmation and QPay reconciliation intact.
export function phoneOrderingGuard(env) {
  return (req, _res, next) => {
    const createsOrderOrPayment = req.method === 'POST' && (
      /^\/(orders|enrollments|payments)\/?$/i.test(req.path) ||
      /^\/me\/wallet\/topups\/?$/i.test(req.path) ||
      /^\/orders\/[^/]+\/(wallet|qpay|bank-transfer)\/?$/i.test(req.path)
    );
    if (phoneOnlyOrdering(env) && createsOrderOrPayment) return next(new HttpError(409, 'phone_ordering_only', 'Orders are currently accepted by phone only'));
    next();
  };
}
