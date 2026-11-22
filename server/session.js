import crypto from 'node:crypto';

const SESSION_DURATION_MS = 30 * 60 * 1000;

function readCookie(cookieHeader, name) {
  return cookieHeader?.split(';').map((item) => item.trim().split('=')).find(([key]) => key === name)?.[1];
}

export function createSessionStore() {
  const sessions = new Map();
  return {
    attach(req, _res, next) {
      const token = readCookie(req.headers.cookie, 'matricula_session');
      req.session = token ? sessions.get(token) : undefined;
      if (req.session?.expiresAt <= Date.now()) req.session = undefined;
      next();
    },
    create(res, user) {
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_DURATION_MS });
      res.cookie('matricula_session', token, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_DURATION_MS });
    },
    destroy(req, res) {
      const token = readCookie(req.headers.cookie, 'matricula_session');
      if (token) sessions.delete(token);
      res.clearCookie('matricula_session');
    },
  };
}
