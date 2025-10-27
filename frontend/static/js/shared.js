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

export function showSetupLinks(show) {
  const links = document.querySelectorAll('.nav-setup');
  links.forEach((link) => link.classList.toggle('d-none', !show));
}
