export class BusinessRuleError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function activeCount(db, sectionId) {
  return db.prepare("SELECT count(*) AS total FROM enrollments WHERE section_id=? AND status='ACTIVE'").get(sectionId).total;
}

export function subjectKind(db, student, subjectId) {
  return db.prepare('SELECT kind FROM curriculum WHERE course_id=? AND subject_id=?').get(student.course_id, subjectId)?.kind ?? 'FREE';
}

export function enrollStudent(db, student, sectionId) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const section = db.prepare('SELECT * FROM sections WHERE id=?').get(sectionId);
    if (!section) throw new BusinessRuleError(404, 'Turma não encontrada.');
    if (activeCount(db, section.id) >= section.capacity) throw new BusinessRuleError(409, 'Turma lotada.');
    if (db.prepare("SELECT 1 FROM history WHERE student_id=? AND subject_id=? AND status='APPROVED'").get(student.id, section.subject_id)) throw new BusinessRuleError(409, 'Você já foi aprovado nesta disciplina.');
    const missing = db.prepare(`SELECT d.code FROM prerequisites p JOIN subjects d ON d.id=p.prerequisite_id LEFT JOIN history h ON h.subject_id=p.prerequisite_id AND h.student_id=? AND h.status='APPROVED' WHERE p.subject_id=? AND h.student_id IS NULL`).all(student.id, section.subject_id);
    if (missing.length) throw new BusinessRuleError(409, `Pré-requisito não cumprido: ${missing.map((item) => item.code).join(', ')}.`);
    const result = db.prepare("INSERT INTO enrollments(student_id,section_id,status) VALUES(?,?,'ACTIVE') ON CONFLICT(student_id,section_id) DO UPDATE SET status='ACTIVE' WHERE status='CANCELLED'").run(student.id, section.id);
    if (!result.changes) throw new BusinessRuleError(409, 'Você já possui matrícula ativa nesta turma.');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function calculateProgress(db, student) {
  const course = db.prepare('SELECT * FROM courses WHERE id=?').get(student.course_id);
  const completedRows = db.prepare(`SELECT h.subject_id,d.hours FROM history h JOIN subjects d ON d.id=h.subject_id WHERE h.student_id=? AND h.status='APPROVED'`).all(student.id);
  const currentRows = db.prepare(`SELECT s.subject_id,d.hours FROM enrollments e JOIN sections s ON s.id=e.section_id JOIN subjects d ON d.id=s.subject_id WHERE e.student_id=? AND e.status='ACTIVE'`).all(student.id);
  const completedHours = (kind) => completedRows.filter((item) => subjectKind(db, student, item.subject_id) === kind).reduce((sum, item) => sum + item.hours, 0);
  const groups = [['REQUIRED', 'Obrigatórias', course.required_hours], ['PROFILE', 'Eletivas de perfil', course.profile_hours], ['FREE', 'Eletivas livres', course.free_hours]];
  return groups.map(([kind, label, required]) => {
    let completed = completedHours(kind);
    if (kind === 'FREE') completed += Math.max(0, completedHours('PROFILE') - course.profile_hours);
    const inProgress = currentRows.filter((item) => subjectKind(db, student, item.subject_id) === kind).reduce((sum, item) => sum + item.hours, 0);
    return { label, required, completed: Math.min(completed, required), inProgress, remaining: Math.max(required - completed, 0), percent: Math.min(100, Math.round((completed / required) * 100)) };
  });
}
