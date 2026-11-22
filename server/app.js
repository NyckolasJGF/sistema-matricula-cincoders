import cors from 'cors';
import express from 'express';
import { createSessionStore } from './session.js';
import { fail } from './http.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerOfficeRoutes } from './routes/office.js';
import { registerStudentRoutes } from './routes/student.js';

export function createApp(db) {
  const app = express();
  const sessions = createSessionStore();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(sessions.attach);
  app.use((req, _res, next) => {
    req.user = req.session && db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId);
    next();
  });

  const auth = (role) => (req, res, next) => {
    if (!req.user) return fail(res, 401, 'Sua sessão expirou. Entre novamente.');
    if (role && req.user.role !== role) return fail(res, 403, 'Você não tem permissão para esta ação.');
    return next();
  };

  const dependencies = { db, auth };
  registerAuthRoutes(app, { ...dependencies, sessions });
  registerStudentRoutes(app, dependencies);
  registerOfficeRoutes(app, dependencies);

  return app;
}
