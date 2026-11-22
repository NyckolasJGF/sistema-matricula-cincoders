import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Table from '../components/Table';
import SubjectSummary from '../components/SubjectSummary';
import { request } from '../services/api';

const tabs = [
  ['offers', 'Ofertas'],
  ['enrollments', 'Minhas matrículas'],
  ['progress', 'Progresso'],
];

const kindLabels = {
  REQUIRED: 'Obrigatória',
  PROFILE: 'Eletiva de perfil',
  FREE: 'Eletiva livre',
};

const titles = {
  offers: 'Escolha disciplinas que movem sua formação.',
  enrollments: 'Suas escolhas neste semestre.',
  progress: 'Acompanhe sua trajetória.',
};

export default function StudentPage({ setError }) {
  const [view, setView] = useState('offers');
  const [data, setData] = useState([]);
  const [query, setQuery] = useState(new URLSearchParams(location.search).get('q') ?? '');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const reduceMotion = useReducedMotion();
  const currentPage = Number(new URLSearchParams(location.search).get('page')) || 1;

  async function load(page = currentPage) {
    setLoading(true);
    setError('');

    try {
      if (view === 'offers') {
        const params = new URLSearchParams({ q: query, page: String(page) });
        history.replaceState(null, '', `?${params}`);
        setData(await request(`/offers?${params}`));
      } else {
        setData(await request(view === 'enrollments' ? '/enrollments/me' : '/progress'));
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [view]);

  async function enroll(sectionId) {
    try {
      await request('/enrollments', { method: 'POST', body: JSON.stringify({ sectionId }) });
      setNotice('Matrícula realizada. A vaga agora aparece em Minhas matrículas.');
      await load();
    } catch (error) {
      setError(error.message);
    }
  }

  async function cancel(enrollmentId) {
    try {
      await request(`/enrollments/${enrollmentId}`, { method: 'DELETE' });
      setNotice('Matrícula cancelada e vaga liberada para a turma.');
      await load();
    } catch (error) {
      setError(error.message);
    }
  }

  const pages = Math.max(1, Math.ceil((data.total ?? 0) / (data.size ?? 5)));

  return (
    <section className="content">
      <nav className="student-nav" aria-label="Navegação do aluno">
        {tabs.map(([id, label]) => (
          <button
            className={view === id ? 'active' : ''}
            onClick={() => { setView(id); setNotice(''); }}
            key={id}
          >
            {label}
            {view === id && <motion.span className="tab-indicator" layoutId="student-tab" transition={{ duration: reduceMotion ? 0 : 0.22 }} />}
          </button>
        ))}
      </nav>

      <div className="page-intro">
        <span>2026.2 · Graduação</span>
        <h1>{titles[view]}</h1>
      </div>

      <AnimatePresence>
        {notice && <motion.p
          className="action-notice"
          role="status"
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          {notice}
        </motion.p>}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={!reduceMotion}>
        <motion.div
          className="student-view"
          key={view}
          aria-busy={loading}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <StudentView
            view={view}
            data={data}
            query={query}
            currentPage={currentPage}
            pages={pages}
            reduceMotion={reduceMotion}
            onQueryChange={setQuery}
            onSearch={() => load(1)}
            onPageChange={load}
            onEnroll={enroll}
            onCancel={cancel}
          />
          {loading && <div className="loading-overlay" role="status">Atualizando informações…</div>}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function StudentView({
  view, data, query, currentPage, pages, reduceMotion, onQueryChange, onSearch, onPageChange, onEnroll, onCancel,
}) {
  if (view === 'offers') {
    return <>
      <div className="search">
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar disciplina" />
        <button onClick={onSearch}>Buscar</button>
      </div>
      <Table
        rows={data.items ?? []}
        columns={['code', 'name', 'section', 'professor', 'hours', 'kind']}
        renderCell={{
          name: (name, row) => <SubjectSummary name={name} description={row.description} />,
          kind: (kind) => <span className="kind-badge">{kindLabels[kind]}</span>,
        }}
        action={(row) => <button onClick={() => onEnroll(row.sectionId)} disabled={row.occupied >= row.capacity}>Matricular ({row.capacity - row.occupied} vagas)</button>}
      />
      <div className="pagination">
        <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>Anterior</button>
        <span>Página {currentPage} de {pages}</span>
        <button disabled={currentPage >= pages} onClick={() => onPageChange(currentPage + 1)}>Próxima</button>
      </div>
    </>;
  }

  if (view === 'enrollments') {
    return <Table
      rows={data}
      columns={['code', 'name', 'section', 'hours', 'kind']}
      renderCell={{
        name: (name, row) => <SubjectSummary name={name} description={row.description} />,
        kind: (kind) => <span className="kind-badge">{kindLabels[kind]}</span>,
      }}
      action={(row) => <button onClick={() => onCancel(row.id)}>Cancelar</button>}
    />;
  }

  return <div className="cards">
    {data.map((item, index) => <motion.article
      key={item.label}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reduceMotion ? 0 : index * 0.08 }}
    >
      <h2>{item.label}</h2>
      <b>{item.percent}% concluído</b>
      <p>Exigida: {item.required}h · Integralizada: {item.completed}h</p>
      <p>Em curso: {item.inProgress}h · Falta: {item.remaining}h</p>
    </motion.article>)}
  </div>;
}
