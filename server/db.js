import Database from 'better-sqlite3';

export function createDb(filename = ':memory:') {
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY, name TEXT NOT NULL, required_hours INTEGER NOT NULL, profile_hours INTEGER NOT NULL, free_hours INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, hours INTEGER NOT NULL CHECK(hours BETWEEN 15 AND 120 AND hours % 15 = 0));
    CREATE TABLE IF NOT EXISTS curriculum (course_id INTEGER, subject_id INTEGER, kind TEXT CHECK(kind IN ('REQUIRED','PROFILE')), PRIMARY KEY(course_id,subject_id));
    CREATE TABLE IF NOT EXISTS prerequisites (subject_id INTEGER, prerequisite_id INTEGER, PRIMARY KEY(subject_id,prerequisite_id));
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK(role IN ('OFFICE','STUDENT')), course_id INTEGER);
    CREATE TABLE IF NOT EXISTS professors (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS sections (id INTEGER PRIMARY KEY, subject_id INTEGER NOT NULL, professor_id INTEGER NOT NULL, capacity INTEGER NOT NULL CHECK(capacity > 0));
    CREATE TABLE IF NOT EXISTS enrollments (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, section_id INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('ACTIVE','CANCELLED')), UNIQUE(student_id,section_id));
    CREATE TABLE IF NOT EXISTS history (student_id INTEGER, subject_id INTEGER, status TEXT CHECK(status IN ('APPROVED','FAILED')), PRIMARY KEY(student_id,subject_id));
  `);
  return db;
}

export function seed(db) {
  if (db.prepare('SELECT count(*) AS n FROM users').get().n) {
    db.prepare("INSERT OR IGNORE INTO curriculum(course_id,subject_id,kind) VALUES(1,5,'PROFILE')").run();
    return;
  }
  db.exec(`
    INSERT INTO courses VALUES (1,'Ciência da Computação',120,60,30),(2,'Sistemas de Informação',90,75,45);
    INSERT INTO subjects VALUES (1,'IF1000','Programação I',60),(2,'IF1001','Estruturas de Dados',60),(3,'IF1002','Banco de Dados',45),(4,'IF1003','Inteligência Artificial',60),(5,'IF1004','Projeto Integrador',30),(6,'IF1005','Redes de Computadores',45);
    INSERT INTO curriculum VALUES (1,1,'REQUIRED'),(1,2,'REQUIRED'),(1,3,'REQUIRED'),(1,4,'PROFILE'),(1,5,'PROFILE'),(2,1,'REQUIRED'),(2,3,'REQUIRED'),(2,5,'REQUIRED'),(2,4,'PROFILE');
    INSERT INTO prerequisites VALUES (2,1),(4,2),(5,1);
    INSERT INTO users VALUES (1,'secretaria','OFFICE',NULL),(2,'ana','STUDENT',1),(3,'bruno','STUDENT',2);
    INSERT INTO professors VALUES (1,'Ada Lovelace','ada@cin.ufpe.br'),(2,'Alan Turing','alan@cin.ufpe.br');
    INSERT INTO sections VALUES (1,1,1,2),(2,2,2,2),(3,3,1,3),(4,4,2,1),(5,5,1,2),(6,6,2,2);
    INSERT INTO history VALUES (2,1,'APPROVED'),(2,3,'FAILED'),(3,1,'APPROVED'),(3,3,'APPROVED');
    INSERT INTO enrollments VALUES (1,2,3,'ACTIVE');
  `);
}
