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

export function enableDemoMode() {
  const url = new URL(window.location.href);
  url.searchParams.set('demo', '1');
  window.location.href = url.toString();
}
