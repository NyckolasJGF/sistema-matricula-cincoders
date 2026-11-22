import { useEffect, useState } from 'react';
import Table from '../components/Table';
import { request } from '../services/api';

const tabs = [['offers', 'Ofertas'], ['enrollments', 'Minhas matrículas'], ['progress', 'Progresso']];
const kindLabels = { REQUIRED: 'Obrigatória', PROFILE: 'Eletiva de perfil', FREE: 'Eletiva livre' };

export default function StudentPage({ user, setError }) {
  const [view, setView] = useState('offers');
  const [data, setData] = useState([]);
  const [query, setQuery] = useState(new URLSearchParams(location.search).get('q') ?? '');
  const [loading, setLoading] = useState(false);
  const currentPage = Number(new URLSearchParams(location.search).get('page')) || 1;
  async function load(page = currentPage) { setLoading(true); setError(''); try { if (view === 'offers') { const params = new URLSearchParams({ q: query, page: String(page) }); history.replaceState(null, '', `?${params}`); setData(await request(`/offers?${params}`)); } else setData(await request(view === 'enrollments' ? '/enrollments/me' : '/progress')); } catch (error) { setError(error.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, [view]);
  async function enroll(sectionId) { try { await request('/enrollments', { method: 'POST', body: JSON.stringify({ sectionId }) }); await load(); } catch (error) { setError(error.message); } }
  async function cancel(enrollmentId) { try { await request(`/enrollments/${enrollmentId}`, { method: 'DELETE' }); await load(); } catch (error) { setError(error.message); } }
  const pages = Math.max(1, Math.ceil((data.total ?? 0) / (data.size ?? 5)));
  return <section className="content"><nav>{tabs.map(([id, label]) => <button className={view === id ? 'active' : ''} onClick={() => setView(id)} key={id}>{label}</button>)}</nav><div className="page-intro"><span>2026.2 · Graduação</span><h1>{view === 'offers' ? 'Escolha disciplinas que movem sua formação.' : view === 'enrollments' ? 'Suas escolhas neste semestre.' : 'Acompanhe sua trajetória.'}</h1></div>{loading ? <p>Carregando…</p> : <>{view === 'offers' && <><div className="search"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar disciplina"/><button onClick={() => load(1)}>Buscar</button></div><Table rows={data.items ?? []} columns={['code', 'name', 'professor', 'hours', 'kind']} renderCell={{ kind: (kind) => <span className="kind-badge">{kindLabels[kind]}</span> }} action={(row) => <button onClick={() => enroll(row.sectionId)} disabled={row.occupied >= row.capacity}>Matricular ({row.capacity - row.occupied} vagas)</button>}/><div className="pagination"><button disabled={currentPage === 1} onClick={() => load(currentPage - 1)}>Anterior</button><span>Página {currentPage} de {pages}</span><button disabled={currentPage >= pages} onClick={() => load(currentPage + 1)}>Próxima</button></div></>}{view === 'enrollments' && <Table rows={data} columns={['code', 'name', 'hours', 'kind']} renderCell={{ kind: (kind) => <span className="kind-badge">{kindLabels[kind]}</span> }} action={(row) => <button onClick={() => cancel(row.id)}>Cancelar</button>}/>} {view === 'progress' && <div className="cards">{data.map((item) => <article key={item.label}><h2>{item.label}</h2><b>{item.percent}% concluído</b><p>Exigida: {item.required}h · Integralizada: {item.completed}h</p><p>Em curso: {item.inProgress}h · Falta: {item.remaining}h</p></article>)}</div>}</>}</section>;
}
