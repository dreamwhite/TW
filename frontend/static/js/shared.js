export async function ensureConfigured() {
  try {
    const response = await fetch('/api/setup/status');
    if (!response.ok) {
      return { configured: true, setupRequired: false };
    }
    const payload = await response.json();
    return { configured: !!payload.configured, setupRequired: !payload.configured };
  } catch (error) {
    console.error('Impossibile verificare lo stato di setup', error);
    return { configured: true, setupRequired: false };
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
  return fetch(url, { ...options, headers });
}
