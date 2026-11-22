const API_URL = '/api';

export async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers } });
  if (response.status === 204) return null;

  const rawBody = await response.text();
  const body = rawBody && response.headers.get('content-type')?.includes('application/json')
    ? JSON.parse(rawBody)
    : {};

  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
    throw new Error(body.error ?? 'Não foi possível comunicar com o servidor.');
  }
  return body;
}
