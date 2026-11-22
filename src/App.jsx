import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import StudentPage from './pages/StudentPage';
import OfficePage from './pages/OfficePage';
import { request } from './services/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const expireSession = () => { setUser(null); setError('Sua sessão expirou. Entre novamente.'); };
    window.addEventListener('session-expired', expireSession);
    return () => window.removeEventListener('session-expired', expireSession);
  }, []);
  if (!user) return <LoginPage onLogin={setUser} error={error} setError={setError}/>;
  async function logout() {
    try { await request('/logout', { method: 'POST' }); } catch (requestError) { setError(requestError.message); }
    setUser(null);
  }
  return (
    <main className="app-shell">
      <header className="app-header reveal-header">
        <div className="brand"><span>◈</span> CInCoders <small>/ Matrículas</small></div>
        <div className="account"><span className="avatar">{user.username.slice(0, 2).toUpperCase()}</span><button onClick={logout}>Sair</button></div>
      </header>
      {error && <p className="error">{error}<button className="retry" onClick={() => window.location.reload()}>Tentar novamente</button><button onClick={() => setError('')}>×</button></p>}
      {user.role === 'STUDENT' ? <StudentPage user={user} setError={setError}/> : <OfficePage user={user} setError={setError}/>} 
    </main>
  );
}
