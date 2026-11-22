import express from 'express';
import cors from 'cors';
import { createSessionStore } from './session.js';
import { activeCount, BusinessRuleError, calculateProgress, enrollStudent, subjectKind } from './services/academic-rules.js';

const fail = (res, status, message) => res.status(status).json({ error: message });
const validEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

export function createApp(db) {
  const app = express();
  const sessions = createSessionStore();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(sessions.attach);
  app.use((req, _res, next) => { req.user = req.session && db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId); next(); });
  const auth = (role) => (req, res, next) => !req.user ? fail(res, 401, 'Sua sessão expirou. Entre novamente.') : role && req.user.role !== role ? fail(res, 403, 'Você não tem permissão para esta ação.') : next();

  app.post('/api/login', (req, res) => { const user = db.prepare('SELECT id,username,role,course_id FROM users WHERE username=?').get(req.body.username?.trim()); if (!user) return fail(res, 401, 'Usuário inválido.'); sessions.create(res, user); res.json({ user }); });
  app.post('/api/logout', auth(), (req, res) => { sessions.destroy(req, res); res.status(204).end(); });
  app.get('/api/me', auth(), (req, res) => res.json({ user: req.user }));

  app.get('/api/offers', auth('STUDENT'), (req, res) => {
    const query = `%${req.query.q ?? ''}%`; const size = 5; const page = Math.max(Number(req.query.page) || 1, 1);
    const rows = db.prepare(`SELECT s.id sectionId,d.id subjectId,d.code,d.name,d.hours,p.name professor,s.capacity FROM sections s JOIN subjects d ON d.id=s.subject_id JOIN professors p ON p.id=s.professor_id WHERE d.code LIKE ? OR d.name LIKE ? ORDER BY d.code`).all(query, query);
    res.json({ items: rows.slice((page - 1) * size, page * size).map((row) => ({ ...row, occupied: activeCount(db, row.sectionId), kind: subjectKind(db, req.user, row.subjectId) })), total: rows.length, page, size });
  });
  app.post('/api/enrollments', auth('STUDENT'), (req, res) => {
    try { enrollStudent(db, req.user, req.body.sectionId); res.status(201).json({ message: 'Matrícula realizada.' }); }
    catch (error) { if (error instanceof BusinessRuleError) return fail(res, error.status, error.message); throw error; }
  });
  app.get('/api/enrollments/me', auth('STUDENT'), (req, res) => {
    const rows = db.prepare(`SELECT e.id,s.subject_id,d.code,d.name,d.hours FROM enrollments e JOIN sections s ON s.id=e.section_id JOIN subjects d ON d.id=s.subject_id WHERE e.student_id=? AND e.status='ACTIVE'`).all(req.user.id);
    res.json(rows.map((row) => ({ ...row, kind: subjectKind(db, req.user, row.subject_id) })));
  });
  app.delete('/api/enrollments/:id', auth('STUDENT'), (req, res) => { const result = db.prepare("UPDATE enrollments SET status='CANCELLED' WHERE id=? AND student_id=? AND status='ACTIVE'").run(req.params.id, req.user.id); if (!result.changes) return fail(res, 404, 'Matrícula ativa não encontrada.'); res.status(204).end(); });
  app.get('/api/progress', auth('STUDENT'), (req, res) => res.json(calculateProgress(db, req.user)));

  app.get('/api/office/subjects', auth('OFFICE'), (_req, res) => res.json(db.prepare('SELECT * FROM subjects ORDER BY code').all()));
  app.post('/api/office/subjects', auth('OFFICE'), (req, res) => { const { code, name, hours } = req.body; if (!code || !name || !Number.isInteger(hours) || hours < 15 || hours > 120 || hours % 15) return fail(res, 422, 'Código, nome e CH (15 a 120, múltipla de 15) são obrigatórios.'); try { res.status(201).json({ id: db.prepare('INSERT INTO subjects(code,name,hours) VALUES(?,?,?)').run(code, name, hours).lastInsertRowid }); } catch { return fail(res, 409, 'Código de disciplina já existe.'); } });
  app.put('/api/office/subjects/:id', auth('OFFICE'), (req, res) => { const { code, name, hours } = req.body; if (!code || !name || !Number.isInteger(hours) || hours < 15 || hours > 120 || hours % 15) return fail(res, 422, 'Código, nome e CH (15 a 120, múltipla de 15) são obrigatórios.'); try { const result = db.prepare('UPDATE subjects SET code=?,name=?,hours=? WHERE id=?').run(code, name, hours, req.params.id); if (!result.changes) return fail(res, 404, 'Disciplina não encontrada.'); res.status(204).end(); } catch { return fail(res, 409, 'Código de disciplina já existe.'); } });
  app.get('/api/office/professors', auth('OFFICE'), (_req, res) => res.json(db.prepare('SELECT * FROM professors ORDER BY name').all()));
  app.post('/api/office/professors', auth('OFFICE'), (req, res) => { const { name, email } = req.body; if (!name || !validEmail(email)) return fail(res, 422, 'Nome e e-mail válido são obrigatórios.'); try { res.status(201).json({ id: db.prepare('INSERT INTO professors(name,email) VALUES(?,?)').run(name, email).lastInsertRowid }); } catch { return fail(res, 409, 'E-mail de professor já existe.'); } });
  app.get('/api/office/sections', auth('OFFICE'), (_req, res) => res.json(db.prepare(`SELECT s.id,d.code,d.name,p.name professor,s.capacity,(SELECT count(*) FROM enrollments e WHERE e.section_id=s.id AND e.status='ACTIVE') occupied FROM sections s JOIN subjects d ON d.id=s.subject_id JOIN professors p ON p.id=s.professor_id ORDER BY d.code`).all()));
  app.post('/api/office/sections', auth('OFFICE'), (req, res) => { const { subjectId, professorId, capacity } = req.body; if (!Number.isInteger(subjectId) || !Number.isInteger(professorId) || !Number.isInteger(capacity) || capacity < 1) return fail(res, 422, 'Disciplina, professor e pelo menos uma vaga são obrigatórios.'); if (!db.prepare('SELECT 1 FROM subjects WHERE id=?').get(subjectId) || !db.prepare('SELECT 1 FROM professors WHERE id=?').get(professorId)) return fail(res, 422, 'Disciplina ou professor inválido.'); res.status(201).json({ id: db.prepare('INSERT INTO sections(subject_id,professor_id,capacity) VALUES(?,?,?)').run(subjectId, professorId, capacity).lastInsertRowid }); });
  app.put('/api/office/sections/:id/capacity', auth('OFFICE'), (req, res) => { const { capacity } = req.body; if (!Number.isInteger(capacity) || capacity < 1) return fail(res, 422, 'Informe pelo menos uma vaga.'); const section = db.prepare('SELECT id FROM sections WHERE id=?').get(req.params.id); if (!section) return fail(res, 404, 'Turma não encontrada.'); if (capacity < activeCount(db, section.id)) return fail(res, 409, 'O total de vagas não pode ser menor que as matrículas ativas.'); db.prepare('UPDATE sections SET capacity=? WHERE id=?').run(capacity, section.id); res.status(204).end(); });
  return app;
}
