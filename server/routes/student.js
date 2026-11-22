import { fail } from '../http.js';
import {
  activeCount,
  BusinessRuleError,
  calculateProgress,
  enrollStudent,
  subjectKind,
} from '../services/academic-rules.js';

export function registerStudentRoutes(app, { db, auth }) {
  app.get('/api/offers', auth('STUDENT'), (req, res) => {
    const query = `%${req.query.q ?? ''}%`;
    const size = 5;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const rows = db.prepare(`SELECT s.id sectionId,d.id subjectId,d.code,d.name,d.description,d.hours,p.name professor,s.capacity FROM sections s JOIN subjects d ON d.id=s.subject_id JOIN professors p ON p.id=s.professor_id WHERE d.code LIKE ? OR d.name LIKE ? ORDER BY d.code`).all(query, query);
    const items = rows.slice((page - 1) * size, page * size).map((row) => ({
      ...row,
      section: `Turma ${String(row.sectionId).padStart(2, '0')}`,
      occupied: activeCount(db, row.sectionId),
      kind: subjectKind(db, req.user, row.subjectId),
    }));
    res.json({ items, total: rows.length, page, size });
  });

  app.post('/api/enrollments', auth('STUDENT'), (req, res) => {
    try {
      enrollStudent(db, req.user, req.body.sectionId);
      res.status(201).json({ message: 'Matrícula realizada.' });
    } catch (error) {
      if (error instanceof BusinessRuleError) return fail(res, error.status, error.message);
      throw error;
    }
  });

  app.get('/api/enrollments/me', auth('STUDENT'), (req, res) => {
    const rows = db.prepare(`SELECT e.id,s.id sectionId,s.subject_id,d.code,d.name,d.description,d.hours FROM enrollments e JOIN sections s ON s.id=e.section_id JOIN subjects d ON d.id=s.subject_id WHERE e.student_id=? AND e.status='ACTIVE'`).all(req.user.id);
    res.json(rows.map((row) => ({ ...row, section: `Turma ${String(row.sectionId).padStart(2, '0')}`, kind: subjectKind(db, req.user, row.subject_id) })));
  });

  app.delete('/api/enrollments/:id', auth('STUDENT'), (req, res) => {
    const result = db.prepare("UPDATE enrollments SET status='CANCELLED' WHERE id=? AND student_id=? AND status='ACTIVE'").run(req.params.id, req.user.id);
    if (!result.changes) return fail(res, 404, 'Matrícula ativa não encontrada.');
    res.status(204).end();
  });

  app.get('/api/progress', auth('STUDENT'), (req, res) => {
    res.json(calculateProgress(db, req.user));
  });
}
