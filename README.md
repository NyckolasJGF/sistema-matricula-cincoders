# Sistema de Matrícula - Cincoders

Aplicação full-stack para matrícula de graduação. A prioridade implementada é a jornada do aluno: login, consulta de ofertas, matrícula, cancelamento e progresso. Há também consultas para a secretaria.

## Rodando localmente

Requer Node.js 20+.

```bash
npm install
npm run dev
```

A interface abre em `http://localhost:5173` (ou 5174) e a API em `http://localhost:3001`. Use `npm run dev` (não `npm run dev:web`) para iniciar os dois processos. Caso a porta 5173 já esteja ocupada, o Vite abrirá outra porta, como 5174; isso é esperado. A primeira execução cria `matricula.db` com dados de demonstração. Usuários: `ana`, `bruno` e `secretaria` (a senha é opcional conforme o enunciado).

```bash
npm test
```

Para manter a formatação consistente antes de cada commit:

```bash
npm run format
npm run build
```

## Organização de código

- `src/pages`: telas por perfil e fluxo;
- `src/components`: elementos reutilizáveis de interface;
- `src/services`: comunicação com a API;
- `server`: inicialização, banco, regras de negócio e testes;
- `server/app.test.js`: testes automatizados das regras de dados.

## Rotas da API

Todas as rotas começam com `/api`. O login cria uma sessão em cookie HTTP-only, válida por 30 minutos.

| Perfil | Método e rota | Finalidade |
| --- | --- | --- |
| Público | `POST /login` | Autentica pelo `username`. |
| Autenticado | `POST /logout`, `GET /me` | Encerra ou consulta a sessão. |
| Aluno | `GET /offers?q=&page=` | Ofertas, busca e paginação. |
| Aluno | `POST /enrollments`, `GET /enrollments/me`, `DELETE /enrollments/:id` | Matricular, listar e cancelar. |
| Aluno | `GET /progress` | Progresso por grupo de carga horária. |
| Secretaria | `GET/POST /office/subjects`, `PUT /office/subjects/:id` | Listar, criar e editar disciplinas. |
| Secretaria | `GET/POST /office/professors` | Listar e cadastrar professores. |
| Secretaria | `GET/POST /office/sections`, `PUT /office/sections/:id/capacity` | Listar/abrir turmas e alterar vagas. |

Erros usam JSON no formato `{ "error": "mensagem clara" }`, com `401` para sessão ausente/expirada, `403` para perfil sem permissão, `409` para conflito de regra de negócio e `422` para dados inválidos.

## Requisito funcional adicional: pré-requisitos

Foi escolhido o requisito de pré-requisitos entre disciplinas. A escolha demonstra uma regra acadêmica comum que afeta tanto a modelagem quanto a matrícula: uma turma só pode ser escolhida se cada pré-requisito estiver aprovado no histórico do aluno.

Exemplos presentes nos dados iniciais:

- Estruturas de Dados exige Programação I;
- Inteligência Artificial exige Estruturas de Dados;
- Projeto Integrador exige Programação I.

A regra é validada exclusivamente no back-end, dentro da mesma transação que protege as vagas. A resposta informa quais códigos ainda precisam ser cumpridos.

## Decisões

- **SQLite**: banco relacional local, simples de revisar e apropriado ao escopo do teste.
- **Express + React**: API e interface desacopladas, com respostas HTTP e erros claros.
- **Sessão por cookie**: o login cria uma sessão de 30 minutos em cookie `httpOnly`; em produção, o armazenamento da sessão deve ser persistente e a autenticação deve incluir senha com hash.
- **Transação de matrícula**: `BEGIN IMMEDIATE` evita que duas requisições ocupem simultaneamente a última vaga de uma turma.
- **Progresso orientado ao curso**: a classificação é calculada a partir da estrutura curricular do aluno, e não da disciplina isolada.

## Regras cobertas

- código e e-mail únicos (schema); CH entre 15 e 120 e múltipla de 15;
- vagas positivas, impedimento de lotação e devolução da vaga no cancelamento;
- estudante só altera as próprias matrículas; aprovação impede nova matrícula;
- classificação por curso, excesso de perfil transferido para livre e progresso limitado a 100%.

## Testes

```bash
npm test
```

Os testes automatizados cobrem restrições de dados, sessão, lotação, aprovação anterior, pré-requisitos, reprovação, cancelamento e reativação de matrícula, classificação por curso, excesso de eletivas de perfil e limites de progresso.

## Evoluções futuras

- usar armazenamento persistente para sessões e senha com hash;
- adicionar testes HTTP de integração às regras já cobertas pelas unidades;
- substituir o `prompt` de alteração de vagas por um modal acessível;
- permitir que a secretaria mantenha a estrutura curricular e o histórico por telas próprias.

## O que faria com mais tempo

- trocar o ajuste de vagas por um modal acessível, sem `prompt` do navegador;
- incluir testes HTTP de integração, além dos testes de regras de negócio;
- adicionar recuperação de senha, hash de senha e armazenamento persistente de sessões;
- permitir à secretaria administrar cursos, currículos, histórico e pré-requisitos pela interface.
