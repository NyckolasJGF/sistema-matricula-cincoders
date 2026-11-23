import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import StudentPage from './pages/StudentPage';
import OfficePage from './pages/OfficePage';
import Brand from './components/Brand';
import ThemeToggle from './components/ThemeToggle';
import { request } from './services/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('matriculas-theme') ?? 'light');
  useEffect(() => {
    const expireSession = () => { setUser(null); setError('Sua sessão expirou. Entre novamente.'); };
    window.addEventListener('session-expired', expireSession);
    return () => window.removeEventListener('session-expired', expireSession);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('matriculas-theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  if (!user) return <LoginPage onLogin={setUser} error={error} setError={setError} theme={theme} onToggleTheme={toggleTheme}/>;
  async function logout() {
    try { await request('/logout', { method: 'POST' }); } catch (requestError) { setError(requestError.message); }
    setUser(null);
  }
  return (
    <main className="app-shell">
      <header className="app-header reveal-header">
        <Brand light detail="Sistema de graduação" />
        <div className="account"><ThemeToggle theme={theme} onToggle={toggleTheme} /><span className="avatar">{user.username.slice(0, 2).toUpperCase()}</span><button onClick={logout}>Sair</button></div>
      </header>
      {error && <p className="error">{error}<button className="retry" onClick={() => window.location.reload()}>Tentar novamente</button><button onClick={() => setError('')}>×</button></p>}
      {user.role === 'STUDENT' ? <StudentPage user={user} setError={setError}/> : <OfficePage user={user} setError={setError}/>} 
    </main>
  );
}
