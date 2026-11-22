import { fail } from '../http.js';
import { activeCount } from '../services/academic-rules.js';

const validEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

function validWorkload(hours) {
  return Number.isInteger(hours) && hours >= 15 && hours <= 120 && hours % 15 === 0;
}

export function registerOfficeRoutes(app, { db, auth }) {
  app.get('/api/office/subjects', auth('OFFICE'), (_req, res) => {
    res.json(db.prepare('SELECT * FROM subjects ORDER BY code').all());
  });

  app.post('/api/office/subjects', auth('OFFICE'), (req, res) => {
    const { code, name, hours } = req.body;
    if (!code || !name || !validWorkload(hours)) return fail(res, 422, 'Código, nome e CH (15 a 120, múltipla de 15) são obrigatórios.');
    try {
      const result = db.prepare('INSERT INTO subjects(code,name,hours) VALUES(?,?,?)').run(code, name, hours);
      res.status(201).json({ id: result.lastInsertRowid });
    } catch { return fail(res, 409, 'Código de disciplina já existe.'); }
  });

  app.put('/api/office/subjects/:id', auth('OFFICE'), (req, res) => {
    const { code, name, hours } = req.body;
    if (!code || !name || !validWorkload(hours)) return fail(res, 422, 'Código, nome e CH (15 a 120, múltipla de 15) são obrigatórios.');
    try {
      const result = db.prepare('UPDATE subjects SET code=?,name=?,hours=? WHERE id=?').run(code, name, hours, req.params.id);
      if (!result.changes) return fail(res, 404, 'Disciplina não encontrada.');
      res.status(204).end();
    } catch { return fail(res, 409, 'Código de disciplina já existe.'); }
  });

  app.get('/api/office/professors', auth('OFFICE'), (_req, res) => res.json(db.prepare('SELECT * FROM professors ORDER BY name').all()));
  app.post('/api/office/professors', auth('OFFICE'), (req, res) => {
    const { name, email } = req.body;
    if (!name || !validEmail(email)) return fail(res, 422, 'Nome e e-mail válido são obrigatórios.');
    try {
      const result = db.prepare('INSERT INTO professors(name,email) VALUES(?,?)').run(name, email);
      res.status(201).json({ id: result.lastInsertRowid });
    } catch { return fail(res, 409, 'E-mail de professor já existe.'); }
  });

  app.get('/api/office/sections', auth('OFFICE'), (_req, res) => {
    res.json(db.prepare(`SELECT s.id,d.code,d.name,p.name professor,s.capacity,(SELECT count(*) FROM enrollments e WHERE e.section_id=s.id AND e.status='ACTIVE') occupied FROM sections s JOIN subjects d ON d.id=s.subject_id JOIN professors p ON p.id=s.professor_id ORDER BY d.code`).all());
  });

  app.post('/api/office/sections', auth('OFFICE'), (req, res) => {
    const { subjectId, professorId, capacity } = req.body;
    if (!Number.isInteger(subjectId) || !Number.isInteger(professorId) || !Number.isInteger(capacity) || capacity < 1) return fail(res, 422, 'Disciplina, professor e pelo menos uma vaga são obrigatórios.');
    if (!db.prepare('SELECT 1 FROM subjects WHERE id=?').get(subjectId) || !db.prepare('SELECT 1 FROM professors WHERE id=?').get(professorId)) return fail(res, 422, 'Disciplina ou professor inválido.');
    const result = db.prepare('INSERT INTO sections(subject_id,professor_id,capacity) VALUES(?,?,?)').run(subjectId, professorId, capacity);
    res.status(201).json({ id: result.lastInsertRowid });
  });

  app.put('/api/office/sections/:id/capacity', auth('OFFICE'), (req, res) => {
    const { capacity } = req.body;
    if (!Number.isInteger(capacity) || capacity < 1) return fail(res, 422, 'Informe pelo menos uma vaga.');
    const section = db.prepare('SELECT id FROM sections WHERE id=?').get(req.params.id);
    if (!section) return fail(res, 404, 'Turma não encontrada.');
    if (capacity < activeCount(db, section.id)) return fail(res, 409, 'O total de vagas não pode ser menor que as matrículas ativas.');
    db.prepare('UPDATE sections SET capacity=? WHERE id=?').run(capacity, section.id);
    res.status(204).end();
  });
}
