import { createDb, seed } from './db.js';
import { createApp } from './app.js';

const db = createDb('matricula.db');
seed(db);

const app = createApp(db);
const server = app.listen(3001, () => {
  console.log('API em http://localhost:3001');
});

server.on('error', (error) => {
  console.error('Não foi possível iniciar a API:', error.message);
  process.exitCode = 1;
});
