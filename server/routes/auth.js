import { fail } from '../http.js';

export function registerAuthRoutes(app, { db, sessions, auth }) {
  app.post('/api/login', (req, res) => {
    const user = db
      .prepare('SELECT id, username, role, course_id FROM users WHERE username=?')
      .get(req.body.username?.trim());

    if (!user) return fail(res, 401, 'Usuário inválido.');

    sessions.create(res, user);
    return res.json({ user });
  });

  app.post('/api/logout', auth(), (req, res) => {
    sessions.destroy(req, res);
    res.status(204).end();
  });

  app.get('/api/me', auth(), (req, res) => res.json({ user: req.user }));
}
