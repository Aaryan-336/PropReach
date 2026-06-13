/**
 * API client for PropReach backend.
 * All calls go through this module with the X-API-Key header injected.
 */

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || '';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'X-API-Key': API_KEY,
    ...options.headers,
  };

  // Don't set Content-Type for FormData (file uploads)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Dashboard ────────────────────────────────────────

export function fetchDashboardStats() {
  return request('/messages/stats');
}

// ── Campaigns ────────────────────────────────────────

export function fetchCampaigns(status) {
  const params = status ? `?status=${status}` : '';
  return request(`/campaigns${params}`);
}

export function fetchCampaign(id) {
  return request(`/campaigns/${id}`);
}

export function createCampaign(data) {
  return request('/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function launchCampaign(id, data = {}) {
  return request(`/campaigns/${id}/launch`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function pauseCampaign(id) {
  return request(`/campaigns/${id}/pause`, { method: 'POST' });
}

export function resumeCampaign(id) {
  return request(`/campaigns/${id}/resume`, { method: 'POST' });
}

export function duplicateCampaign(id) {
  return request(`/campaigns/${id}/duplicate`, { method: 'POST' });
}

export function fetchTemplates(refresh = false) {
  const params = refresh ? '?refresh=true' : '';
  return request(`/campaigns/templates/list${params}`);
}

// ── Contacts ─────────────────────────────────────────

export function fetchContacts({ page = 1, pageSize = 50, search, group, blocked } = {}) {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (search) params.set('search', search);
  if (group) params.set('group', group);
  if (blocked !== undefined) params.set('blocked', blocked);
  return request(`/contacts?${params}`);
}

export function createContact(data) {
  return request('/contacts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function importContacts(file) {
  const formData = new FormData();
  formData.append('file', file);
  return request('/contacts/import', {
    method: 'POST',
    body: formData,
  });
}

export function importContactsFromGSheet(url) {
  return request('/contacts/import-gsheet', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}


export function fetchGroups() {
  return request('/contacts/groups');
}

export function toggleBlockContact(id) {
  return request(`/contacts/${id}/block`, { method: 'PATCH' });
}

export function deleteContact(id) {
  return request(`/contacts/${id}`, { method: 'DELETE' });
}

// ── Messages / Replies ───────────────────────────────

export function fetchMessages({ campaignId, contactId, page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (campaignId) params.set('campaign_id', campaignId);
  if (contactId) params.set('contact_id', contactId);
  return request(`/messages?${params}`);
}

export function fetchReplies({ label, isRead, page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (label) params.set('label', label);
  if (isRead !== undefined) params.set('is_read', isRead);
  return request(`/messages/replies?${params}`);
}

export function updateReply(id, data) {
  const params = new URLSearchParams();
  if (data.label) params.set('label', data.label);
  if (data.agent_note !== undefined) params.set('agent_note', data.agent_note);
  if (data.is_read !== undefined) params.set('is_read', data.is_read);
  return request(`/messages/replies/${id}?${params}`, { method: 'PATCH' });
}

// ── Settings ─────────────────────────────────────────

export function fetchSettings() {
  return request('/settings');
}

export function saveSettings(data) {
  return request('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function testConnection() {
  return request('/settings/test', { method: 'POST' });
}
