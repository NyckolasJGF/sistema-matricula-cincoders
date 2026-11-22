import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb, seed } from './db.js';
import { createSessionStore } from './session.js';
import {
  BusinessRuleError,
  calculateProgress,
  enrollStudent,
  subjectKind,
} from './services/academic-rules.js';

const student = (db, username) => db.prepare("SELECT * FROM users WHERE username=?").get(username);
const expectRule = (callback, message) => assert.throws(callback, (error) => error instanceof BusinessRuleError && error.message.includes(message));

test('dados iniciais têm CH válida e classificação diferente entre cursos', () => {
  const db = createDb(); seed(db);
  assert.equal(db.prepare('SELECT count(*) n FROM subjects WHERE hours % 15 != 0 OR hours < 15 OR hours > 120').get().n, 0);
  assert.equal(db.prepare("SELECT count(*) n FROM curriculum a JOIN curriculum b ON a.subject_id=b.subject_id WHERE a.course_id=1 AND b.course_id=2 AND a.kind != b.kind").get().n > 0, true);
});

test('banco protege código de disciplina, e-mail de professor e capacidade inválida', () => {
  const db = createDb();
  seed(db);

  assert.throws(() => db.prepare("INSERT INTO subjects(code,name,hours) VALUES('IF1000','Duplicada',60)").run());
  assert.throws(() => db.prepare("INSERT INTO subjects(code,name,hours) VALUES('IF9999','CH inválida',50)").run());
  assert.throws(() => db.prepare("INSERT INTO professors(name,email) VALUES('Outra Ada','ada@cin.ufpe.br')").run());
  assert.throws(() => db.prepare('UPDATE sections SET capacity=0 WHERE id=1').run());
});

test('sessão é criada, identificada por cookie e pode ser removida', () => {
  const sessions = createSessionStore(); let cookie;
  const response = { cookie(_name, value) { cookie = `matricula_session=${value}`; }, clearCookie() {} };
  sessions.create(response, { id: 2 });
  const request = { headers: { cookie } };
  sessions.attach(request, response, () => {});
  assert.equal(request.session.userId, 2);
  sessions.destroy(request, response);
  sessions.attach(request, response, () => {});
  assert.equal(request.session, undefined);
});

test('matrícula recusa turma lotada, disciplina aprovada e pré-requisito pendente', () => {
  const db = createDb(); seed(db); const ana = student(db, 'ana'); const bruno = student(db, 'bruno');
  db.prepare('UPDATE sections SET capacity=1 WHERE id=2').run();
  db.prepare("INSERT INTO enrollments(student_id,section_id,status) VALUES(?,?, 'ACTIVE')").run(ana.id, 2);
  expectRule(() => enrollStudent(db, bruno, 2), 'Turma lotada');
  expectRule(() => enrollStudent(db, ana, 1), 'já foi aprovado');
  expectRule(() => enrollStudent(db, ana, 4), 'Pré-requisito');
});

test('disciplina reprovada pode ser cursada e matrícula cancelada pode ser reativada', () => {
  const db = createDb(); seed(db); const ana = student(db, 'ana');
  db.prepare("UPDATE enrollments SET status='CANCELLED' WHERE student_id=? AND section_id=3").run(ana.id);
  enrollStudent(db, ana, 3);
  assert.equal(db.prepare("SELECT status FROM enrollments WHERE student_id=? AND section_id=3").get(ana.id).status, 'ACTIVE');
  db.prepare("UPDATE enrollments SET status='CANCELLED' WHERE student_id=? AND section_id=3").run(ana.id);
  enrollStudent(db, ana, 3);
  assert.equal(db.prepare("SELECT status FROM enrollments WHERE student_id=? AND section_id=3").get(ana.id).status, 'ACTIVE');
});

test('progresso classifica por curso, ignora reprovação e transfere excesso de perfil para livre', () => {
  const db = createDb(); seed(db); const ana = student(db, 'ana');
  db.prepare("INSERT OR REPLACE INTO history(student_id,subject_id,status) VALUES(?,?, 'APPROVED')").run(ana.id, 4);
  db.prepare("INSERT OR REPLACE INTO history(student_id,subject_id,status) VALUES(?,?, 'APPROVED')").run(ana.id, 5);
  const groups = Object.fromEntries(calculateProgress(db, ana).map((group) => [group.label, group]));
  assert.equal(groups['Obrigatórias'].completed, 60);
  assert.equal(groups['Obrigatórias'].inProgress, 45);
  assert.equal(groups['Eletivas de perfil'].completed, 60);
  assert.equal(groups['Eletivas livres'].completed, 30);
});

test('classificação muda conforme o curso e progresso nunca excede 100%', () => {
  const db = createDb();
  seed(db);
  const ana = student(db, 'ana');
  const bruno = student(db, 'bruno');

  assert.equal(subjectKind(db, ana, 5), 'PROFILE');
  assert.equal(subjectKind(db, bruno, 5), 'REQUIRED');

  db.prepare("INSERT OR REPLACE INTO history(student_id,subject_id,status) VALUES(?,?, 'APPROVED')").run(ana.id, 4);
  db.prepare("INSERT OR REPLACE INTO history(student_id,subject_id,status) VALUES(?,?, 'APPROVED')").run(ana.id, 5);
  const groups = calculateProgress(db, ana);
  assert.equal(groups.every((group) => group.percent <= 100 && group.remaining >= 0), true);
});
