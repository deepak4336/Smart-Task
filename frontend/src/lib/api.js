const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api';

async function request(path, { method = 'GET', body, accessToken } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  get: (path, accessToken) => request(path, { accessToken }),
  post: (path, body, accessToken) => request(path, { method: 'POST', body, accessToken }),
  patch: (path, body, accessToken) => request(path, { method: 'PATCH', body, accessToken }),
  delete: (path, accessToken) => request(path, { method: 'DELETE', accessToken }),
};
