export async function ensureConfigured() {
  const devHost = `${window.location.protocol}//localhost:5001`;
  const primary = window.location.port === '8080' ? `${devHost}/api/setup/status` : '/api/setup/status';
  const apiTargets = [primary, '/api/setup/status', `${devHost}/api/setup/status`];
  try {
    for (const url of apiTargets) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const payload = await response.json();
        return { configured: !!payload.configured, setupRequired: !payload.configured };
      } catch (_) {
        // try next target
      }
    }
    return { configured: false, setupRequired: true };
  } catch (error) {
    console.error('Impossibile verificare lo stato di setup', error);
    // In doubt, force setup so the user can reconfigure
    return { configured: false, setupRequired: true };
  }
}

export function getToken() {
  return sessionStorage.getItem('gatewayToken');
}

export function setToken(token) {
  sessionStorage.setItem('gatewayToken', token);
}

export function clearToken() {
  sessionStorage.removeItem('gatewayToken');
}

export function showSetupLinks(show) {
  const links = document.querySelectorAll('.nav-setup');
  links.forEach((link) => link.classList.toggle('d-none', !show));
}

export function requireToken() {
  const token = getToken();
  if (!token) {
    window.location.href = '/index.html';
    return null;
  }
  return token;
}

export async function fetchWithAuth(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = options.token || getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const needsDevHost = window.location.port === '8080' && url.startsWith('/api');
  const base = options.baseUrl || (needsDevHost ? `${window.location.protocol}//localhost:5001` : '');
  const target = base && url.startsWith('/') ? `${base}${url}` : url;
  const response = await fetch(target, { ...options, headers });
  const redirectOnUnauthorized = options.redirectOnUnauthorized !== false;
  if (redirectOnUnauthorized && response.status === 401) {
    clearToken();
    window.location.href = '/index.html';
  }
  return response;
}
