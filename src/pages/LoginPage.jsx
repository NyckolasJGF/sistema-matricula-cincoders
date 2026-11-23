import Brand from '../components/Brand';
import ThemeToggle from '../components/ThemeToggle';

export default function LoginPage({ onLogin, error, setError, theme, onToggleTheme }) {
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-story-header"><Brand light detail="Sistema de graduação" /><ThemeToggle login theme={theme} onToggle={onToggleTheme} /></div>
        <div className="story-copy">
          <p>2026.2 · Graduação</p>
          <h1>Tecnologia a serviço da sua jornada.</h1>
          <span>Organize suas escolhas acadêmicas e acompanhe sua formação em um único lugar.</span>
        </div>
      </section>
      <section className="login-form-area">
        <div className="login-mobile-theme"><ThemeToggle theme={theme} onToggle={onToggleTheme} /></div>
        <div className="login-card">
          <Brand detail="Sistema de graduação" />
          <h1>Boas-vindas.</h1>
          <p>Acesse sua área de matrícula.</p>
          <form
        onSubmit={async (e) => {
          e.preventDefault();

          try {
            const response = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: new FormData(e.currentTarget).get('username'),
              }),
            });

            const rawBody = await response.text();
            const result = rawBody && response.headers.get('content-type')?.includes('application/json')
              ? JSON.parse(rawBody)
              : {};

            if (!response.ok) {
              throw new Error(result.error ?? 'Não foi possível entrar.');
            }

            onLogin(result.user);
          } catch (requestError) {
            setError(requestError.message);
          }
        }}
          >
            <input name="username" placeholder="Usuário" autoFocus />
            <button>Entrar</button>
          </form>
          <small>Teste com <code>ana</code>, <code>bruno</code> ou <code>secretaria</code>.</small>
          {error && <p className="login-error">{error}</p>}
        </div>
      </section>
    </main>
  );
}
