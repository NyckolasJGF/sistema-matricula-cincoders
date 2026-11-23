import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Table from '../components/Table';
import { request } from '../services/api';

const tabs = [
  ['subjects', 'Disciplinas'],
  ['professors', 'Professores'],
  ['sections', 'Turmas'],
];

export default function OfficePage({ setError }) {
  const [view, setView] = useState('subjects');
  const [catalog, setCatalog] = useState({ subjects: [], professors: [], sections: [] });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(new URLSearchParams(location.search).get('q') ?? '');
  const [page, setPage] = useState(Number(new URLSearchParams(location.search).get('page')) || 1);
  const [formError, setFormError] = useState('');
  const [rowErrors, setRowErrors] = useState({});
  const [pendingAction, setPendingAction] = useState('');
  const rowErrorTimers = useRef({});

  async function load() {
    setLoading(true);
    try {
      const [subjects, professors, sections] = await Promise.all([
        request('/office/subjects'),
        request('/office/professors'),
        request('/office/sections'),
      ]);
      setCatalog({ subjects, professors, sections });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(
    () => () => {
      Object.values(rowErrorTimers.current).forEach(window.clearTimeout);
    },
    [],
  );

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const subject = {
      code: form.get('code'),
      name: form.get('name'),
      hours: Number(form.get('hours')),
      description: form.get('description'),
    };

    setPendingAction('form');
    try {
      if (view === 'subjects') {
        await request(editing ? `/office/subjects/${editing.id}` : '/office/subjects', {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify(subject),
        });
      }
      if (view === 'professors') {
        await request('/office/professors', {
          method: 'POST',
          body: JSON.stringify({ name: form.get('name'), email: form.get('email') }),
        });
      }
      if (view === 'sections') {
        await request('/office/sections', {
          method: 'POST',
          body: JSON.stringify({
            subjectId: Number(form.get('subjectId')),
            professorId: Number(form.get('professorId')),
            capacity: Number(form.get('capacity')),
          }),
        });
      }
      setEditing(null);
      formElement.reset();
      await load();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setPendingAction('');
    }
  }

  function setRowError(key, message) {
    window.clearTimeout(rowErrorTimers.current[key]);
    setRowErrors((errors) => ({ ...errors, [key]: message }));
    if (message) {
      rowErrorTimers.current[key] = window.setTimeout(() => {
        setRowErrors((errors) => ({ ...errors, [key]: '' }));
      }, 3000);
    }
  }

  async function updateCapacity(row) {
    const capacity = Number(window.prompt(`Novo total de vagas para ${row.code}:`, row.capacity));
    if (!Number.isInteger(capacity)) return;
    const key = `section-${row.id}`;
    setRowError(key, '');
    setPendingAction(key);
    try {
      await request(`/office/sections/${row.id}/capacity`, {
        method: 'PUT',
        body: JSON.stringify({ capacity }),
      });
      await load();
    } catch (error) {
      setRowError(key, error.message);
    } finally {
      setPendingAction('');
    }
  }

  async function deleteProfessor(row) {
    if (!window.confirm(`Excluir o professor ${row.name}?`)) return;
    const key = `professor-${row.id}`;
    setRowError(key, '');
    setPendingAction(key);
    try {
      await request(`/office/professors/${row.id}`, { method: 'DELETE' });
      await load();
    } catch (error) {
      setRowError(key, error.message);
    } finally {
      setPendingAction('');
    }
  }

  async function deleteSection(row) {
    if (!window.confirm(`Excluir ${row.section} de ${row.code}?`)) return;
    const key = `section-${row.id}`;
    setRowError(key, '');
    setPendingAction(key);
    try {
      await request(`/office/sections/${row.id}`, { method: 'DELETE' });
      await load();
    } catch (error) {
      setRowError(key, error.message);
    } finally {
      setPendingAction('');
    }
  }

  const matchingSubjects = catalog.subjects.filter((item) =>
    `${item.code} ${item.name} ${item.description ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(matchingSubjects.length / pageSize));
  const rows =
    view === 'subjects'
      ? matchingSubjects.slice((page - 1) * pageSize, page * pageSize)
      : catalog[view];
  const columns =
    view === 'subjects'
      ? ['code', 'name', 'hours']
      : view === 'professors'
        ? ['name', 'email']
        : ['section', 'code', 'name', 'professor', 'occupied', 'capacity'];
  const heading =
    view === 'subjects'
      ? 'Disciplinas'
      : view === 'professors'
        ? 'Professores'
        : 'Turmas do semestre';

  function searchSubjects(nextPage = 1) {
    const parameters = new URLSearchParams({ q: query, page: String(nextPage) });
    history.replaceState(null, '', `?${parameters}`);
    setPage(nextPage);
  }

  function professorActions(row) {
    const key = `professor-${row.id}`;
    return (
      <div className="table-action-feedback">
        <button
          className="danger-action"
          disabled={pendingAction === key}
          onClick={() => deleteProfessor(row)}
        >
          {pendingAction === key ? 'Excluindo…' : 'Excluir'}
        </button>
        <RowError message={rowErrors[key]} />
      </div>
    );
  }

  function sectionActions(row) {
    const key = `section-${row.id}`;
    return (
      <div className="table-action-feedback">
        <div className="table-actions">
          <button disabled={pendingAction === key} onClick={() => updateCapacity(row)}>
            Alterar vagas
          </button>
          <button
            className="danger-action"
            disabled={pendingAction === key}
            onClick={() => deleteSection(row)}
          >
            {pendingAction === key ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
        <RowError message={rowErrors[key]} />
      </div>
    );
  }

  return (
    <section className="content office-content">
      <nav aria-label="Navegação da secretaria">
        {tabs.map(([id, label]) => (
          <button
            className={view === id ? 'active' : ''}
            onClick={() => {
              setView(id);
              setEditing(null);
              setFormError('');
              setRowErrors({});
            }}
            key={id}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="page-intro">
        <span>Secretaria · 2026.2</span>
        <h1>Gestão acadêmica em um só lugar.</h1>
        <p>Organize disciplinas, professores, turmas e vagas do semestre atual.</p>
      </div>

      <div className="office-stats" aria-label="Resumo do semestre">
        <article>
          <span>Disciplinas ativas</span>
          <strong>{catalog.subjects.length}</strong>
          <small>cadastradas no sistema</small>
        </article>
        <article>
          <span>Turmas abertas</span>
          <strong>{catalog.sections.length}</strong>
          <small>disponíveis neste semestre</small>
        </article>
        <article>
          <span>Matrículas ativas</span>
          <strong>{catalog.sections.reduce((total, row) => total + row.occupied, 0)}</strong>
          <small>vagas já ocupadas</small>
        </article>
      </div>

      <section className="office-table">
        <div className="office-table-header">
          <div>
            <h2>{heading}</h2>
            <p>Cadastre e mantenha os dados atualizados.</p>
          </div>
        </div>

        {loading ? (
          <p className="loading-state">Carregando dados da secretaria…</p>
        ) : (
          <>
            {view === 'subjects' && (
              <div className="search">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar disciplina"
                />
                <button onClick={() => searchSubjects(1)}>Buscar</button>
              </div>
            )}

            <form className="admin-form" onSubmit={submit} key={`${view}-${editing?.id ?? 'new'}`}>
              {view === 'subjects' && (
                <>
                  <input
                    name="code"
                    defaultValue={editing?.code}
                    placeholder="Código (ex.: IF1006)"
                    required
                  />
                  <input
                    name="name"
                    defaultValue={editing?.name}
                    placeholder="Nome da disciplina"
                    required
                  />
                  <input
                    name="hours"
                    defaultValue={editing?.hours}
                    type="number"
                    min="15"
                    max="120"
                    step="15"
                    placeholder="CH"
                    required
                  />
                  <textarea
                    name="description"
                    defaultValue={editing?.description}
                    maxLength="280"
                    placeholder="Resumo da disciplina (opcional, até 280 caracteres)"
                  />
                </>
              )}
              {view === 'professors' && (
                <>
                  <input name="name" placeholder="Nome do professor" required />
                  <input name="email" type="email" placeholder="E-mail institucional" required />
                </>
              )}
              {view === 'sections' && (
                <>
                  <select name="subjectId" required defaultValue="">
                    <option value="" disabled>
                      Disciplina
                    </option>
                    {catalog.subjects.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.code} — {item.name}
                      </option>
                    ))}
                  </select>
                  <select name="professorId" required defaultValue="">
                    <option value="" disabled>
                      Professor
                    </option>
                    {catalog.professors.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input name="capacity" type="number" min="1" placeholder="Vagas" required />
                </>
              )}
              <button disabled={pendingAction === 'form'}>
                {pendingAction === 'form'
                  ? 'Salvando…'
                  : editing
                    ? 'Salvar edição'
                    : view === 'subjects'
                      ? '+ Nova disciplina'
                      : view === 'professors'
                        ? '+ Novo professor'
                        : '+ Abrir turma'}
              </button>
              {editing && (
                <button
                  type="button"
                  className="cancel-edit"
                  onClick={() => {
                    setEditing(null);
                    setFormError('');
                  }}
                >
                  Cancelar
                </button>
              )}
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
            </form>

            <Table
              rows={rows}
              columns={columns}
              columnLabels={view === 'professors' ? { name: 'Professor' } : undefined}
              action={
                view === 'subjects'
                  ? (row) => <button onClick={() => setEditing(row)}>Editar</button>
                  : view === 'professors'
                    ? professorActions
                    : sectionActions
              }
            />

            {view === 'subjects' && (
              <div className="pagination">
                <button disabled={page === 1} onClick={() => searchSubjects(page - 1)}>
                  Anterior
                </button>
                <span>
                  Página {page} de {totalPages}
                </span>
                <button disabled={page >= totalPages} onClick={() => searchSubjects(page + 1)}>
                  Próxima
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </section>
  );
}

function RowError({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, x: -8, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -5, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
