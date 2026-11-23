import { fail } from '../http.js';
import { BusinessRuleError, updateSectionCapacity } from '../services/academic-rules.js';

const validEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

function validWorkload(hours) {
  return Number.isInteger(hours) && hours >= 15 && hours <= 120 && hours % 15 === 0;
}

function validDescription(description) {
  return typeof description === 'string' && description.trim().length <= 280;
}

export function registerOfficeRoutes(app, { db, auth }) {
  app.get('/api/office/subjects', auth('OFFICE'), (_req, res) => {
    res.json(db.prepare('SELECT * FROM subjects ORDER BY code').all());
  });

  app.post('/api/office/subjects', auth('OFFICE'), (req, res) => {
    const { code, name, hours, description = '' } = req.body;
    if (!code || !name || !validWorkload(hours))
      return fail(res, 422, 'Código, nome e CH (15 a 120, múltipla de 15) são obrigatórios.');
    if (!validDescription(description))
      return fail(res, 422, 'O resumo deve ter no máximo 280 caracteres.');
    try {
      const result = db
        .prepare('INSERT INTO subjects(code,name,hours,description) VALUES(?,?,?,?)')
        .run(code, name, hours, description.trim());
      res.status(201).json({ id: result.lastInsertRowid });
    } catch {
      return fail(res, 409, 'Código de disciplina já existe.');
    }
  });

  app.put('/api/office/subjects/:id', auth('OFFICE'), (req, res) => {
    const { code, name, hours, description = '' } = req.body;
    if (!code || !name || !validWorkload(hours))
      return fail(res, 422, 'Código, nome e CH (15 a 120, múltipla de 15) são obrigatórios.');
    if (!validDescription(description))
      return fail(res, 422, 'O resumo deve ter no máximo 280 caracteres.');
    try {
      const result = db
        .prepare('UPDATE subjects SET code=?,name=?,hours=?,description=? WHERE id=?')
        .run(code, name, hours, description.trim(), req.params.id);
      if (!result.changes) return fail(res, 404, 'Disciplina não encontrada.');
      res.status(204).end();
    } catch {
      return fail(res, 409, 'Código de disciplina já existe.');
    }
  });

  app.get('/api/office/professors', auth('OFFICE'), (_req, res) =>
    res.json(db.prepare('SELECT * FROM professors ORDER BY name').all()),
  );
  app.post('/api/office/professors', auth('OFFICE'), (req, res) => {
    const { name, email } = req.body;
    if (!name || !validEmail(email))
      return fail(res, 422, 'Nome e e-mail válido são obrigatórios.');
    try {
      const result = db.prepare('INSERT INTO professors(name,email) VALUES(?,?)').run(name, email);
      res.status(201).json({ id: result.lastInsertRowid });
    } catch {
      return fail(res, 409, 'E-mail de professor já existe.');
    }
  });

  app.delete('/api/office/professors/:id', auth('OFFICE'), (req, res) => {
    const professor = db.prepare('SELECT id FROM professors WHERE id=?').get(req.params.id);
    if (!professor) return fail(res, 404, 'Professor não encontrado.');
    if (db.prepare('SELECT 1 FROM sections WHERE professor_id=?').get(professor.id)) {
      return fail(res, 409, 'Este professor possui turmas vinculadas e não pode ser excluído.');
    }
    db.prepare('DELETE FROM professors WHERE id=?').run(professor.id);
    res.status(204).end();
  });

  app.get('/api/office/sections', auth('OFFICE'), (_req, res) => {
    const sections = db
      .prepare(
        `SELECT s.id,d.code,d.name,p.name professor,s.capacity,(SELECT count(*) FROM enrollments e WHERE e.section_id=s.id AND e.status='ACTIVE') occupied FROM sections s JOIN subjects d ON d.id=s.subject_id JOIN professors p ON p.id=s.professor_id ORDER BY d.code, p.name`,
      )
      .all();
    res.json(
      sections.map((section) => ({
        ...section,
        section: `Turma ${String(section.id).padStart(2, '0')}`,
      })),
    );
  });

  app.post('/api/office/sections', auth('OFFICE'), (req, res) => {
    const { subjectId, professorId, capacity } = req.body;
    if (
      !Number.isInteger(subjectId) ||
      !Number.isInteger(professorId) ||
      !Number.isInteger(capacity) ||
      capacity < 1
    )
      return fail(res, 422, 'Disciplina, professor e pelo menos uma vaga são obrigatórios.');
    if (
      !db.prepare('SELECT 1 FROM subjects WHERE id=?').get(subjectId) ||
      !db.prepare('SELECT 1 FROM professors WHERE id=?').get(professorId)
    )
      return fail(res, 422, 'Disciplina ou professor inválido.');
    if (
      db
        .prepare('SELECT 1 FROM sections WHERE subject_id=? AND professor_id=?')
        .get(subjectId, professorId)
    )
      return fail(res, 409, 'Já existe uma turma desta disciplina para este professor.');
    const result = db
      .prepare('INSERT INTO sections(subject_id,professor_id,capacity) VALUES(?,?,?)')
      .run(subjectId, professorId, capacity);
    res.status(201).json({ id: result.lastInsertRowid });
  });

  app.delete('/api/office/sections/:id', auth('OFFICE'), (req, res) => {
    const section = db.prepare('SELECT id FROM sections WHERE id=?').get(req.params.id);
    if (!section) return fail(res, 404, 'Turma não encontrada.');
    if (db.prepare('SELECT 1 FROM enrollments WHERE section_id=?').get(section.id)) {
      return fail(res, 409, 'Esta turma possui matrículas registradas e não pode ser excluída.');
    }
    db.prepare('DELETE FROM sections WHERE id=?').run(section.id);
    res.status(204).end();
  });

  app.put('/api/office/sections/:id/capacity', auth('OFFICE'), (req, res) => {
    const { capacity } = req.body;
    if (!Number.isInteger(capacity) || capacity < 1)
      return fail(res, 422, 'Informe pelo menos uma vaga.');
    try {
      updateSectionCapacity(db, req.params.id, capacity);
      res.status(204).end();
    } catch (error) {
      if (error instanceof BusinessRuleError) return fail(res, error.status, error.message);
      throw error;
    }
  });
}
