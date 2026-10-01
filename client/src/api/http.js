const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  token = localStorage.getItem('lab_booking_token') || '';

  setToken(token) {
    this.token = token || '';
    if (token) localStorage.setItem('lab_booking_token', token);
    else localStorage.removeItem('lab_booking_token');
  }

  async request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    const payload = await response.json().catch(() => ({ success: false, message: 'Invalid server response' }));
    if (!response.ok) {
      const error = new Error(payload.message || 'Request failed');
      error.status = response.status;
      error.details = payload.details;
      throw error;
    }
    return payload.data ?? payload;
  }

  get(path) { return this.request(path); }
  post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); }
  put(path, body) { return this.request(path, { method: 'PUT', body: JSON.stringify(body) }); }
  patch(path, body = {}) { return this.request(path, { method: 'PATCH', body: JSON.stringify(body) }); }
  delete(path) { return this.request(path, { method: 'DELETE' }); }
}

export const api = new ApiClient();
