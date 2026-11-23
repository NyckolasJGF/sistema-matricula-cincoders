export default function ThemeToggle({ theme, onToggle, login = false }) {
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle--${theme}${login ? ' theme-toggle--login' : ''}`}
      onClick={onToggle}
      aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      aria-pressed={dark}
    >
      <span className="theme-toggle__thumb" aria-hidden="true">{dark ? '☾' : '☀'}</span>
      <span className="sr-only">{dark ? 'Tema escuro ativo' : 'Tema claro ativo'}</span>
    </button>
  );
}
