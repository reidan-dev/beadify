/**
 * Thin fetch wrappers for the FastAPI backend.
 *
 * import.meta.env.BASE_URL is set by Vite to match the `base` config value
 * (e.g. '/beadify-it/' for a subpath deploy, '/' otherwise).
 * Strip the trailing slash so we can write `/process` as the path suffix.
 */
const ROOT = import.meta.env.BASE_URL.replace(/\/$/, '');

async function apiFetch(path, init) {
  const resp = await fetch(`${ROOT}${path}`, init);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || resp.statusText);
  }
  return resp.json();
}

export async function processImage(formData) {
  return apiFetch('/process', { method: 'POST', body: formData });
}

export async function processMulti(formData) {
  return apiFetch('/process-multi', { method: 'POST', body: formData });
}

export async function getPalette() {
  return apiFetch('/palette');
}

export async function saveProgress(name, project) {
  const resp = await fetch(`${ROOT}/progress/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  if (!resp.ok) throw new Error(resp.statusText);
}

export async function loadProgress(name) {
  const resp = await fetch(`${ROOT}/progress/${encodeURIComponent(name)}`);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(resp.statusText);
  return resp.json();
}

export function exportCountsUrl(name) {
  return `${ROOT}/export/counts/${encodeURIComponent(name)}`;
}
