const BASE_URL = 'https://siilvered-pavey-backend.hf.space';

let apiToken: string | null = null;

export function setApiToken(token: string | null) {
  apiToken = token;
}

function getToken(): string | null {
  if (apiToken) return apiToken;
  try {
    const raw = localStorage.getItem('pavey_state');
    if (!raw) return null;
    const state = JSON.parse(raw);
    return state.accessToken ?? null;
  } catch {
    return null;
  }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Hanya clear token dan redirect kalau path adalah protected route
    // Jangan redirect kalau sedang di halaman yang memang bisa diakses tanpa login
    localStorage.removeItem('pavey_state');
    window.location.href = '/onboarding';
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Request failed');
  return data;
}

/**
 * apiFetchSafe — seperti apiFetch tapi TIDAK clear session/redirect on 401.
 * Dipakai untuk endpoint yang authnya opsional (chatbot, dll).
 */
async function apiFetchSafe(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Request failed');
  return data;
}

export async function apiRegister(email: string, password: string) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiLogin(email: string, password: string) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiGetTrips() {
  return apiFetch('/trips/');
}

export async function apiCreateTrip(data: {
  destination: string;
  start_date: string;
  end_date: string;
  vibe: string;
  budget_min: number;
  budget_max: number;
}) {
  return apiFetch('/trips/', { method: 'POST', body: JSON.stringify(data) });
}

export async function apiGetExpenses(tripId: string) {
  return apiFetch(`/wallet/expenses/${tripId}`);
}

export async function apiAddExpense(data: {
  trip_id: string;
  amount: number;
  category: string;
  description: string;
}) {
  return apiFetch('/wallet/expenses', { method: 'POST', body: JSON.stringify(data) });
}

export async function apiDeleteExpense(expenseId: string) {
  return apiFetch(`/wallet/expenses/${expenseId}`, { method: 'DELETE' });
}

export async function apiGetExpenseSummary(tripId: string) {
  return apiFetch(`/wallet/expenses/${tripId}/summary`);
}

export async function apiConvertExpenses(tripId: string, targetCurrency: string) {
  return apiFetch(`/wallet/expenses/${tripId}/convert?target_currency=${targetCurrency}`, {
    method: 'POST',
  });
}

export async function apiChat(message: string, tripId?: string, context?: string) {
  // Pakai apiFetchSafe karena chatbot mendukung guest (auth opsional)
  // — jangan wipe session kalau ada 401 dari Supabase token yang expired
  return apiFetchSafe('/chatbot/message', {
    method: 'POST',
    body: JSON.stringify({ message, trip_id: tripId, context }),
  });
}

export async function apiSocialParse(url: string, tripId?: string) {
  // Pakai apiFetchSafe — kalau tidak login, tetap bisa parse (backend handle optional auth)
  return apiFetchSafe('/social/parse', {
    method: 'POST',
    body: JSON.stringify({ url, trip_id: tripId }),
  });
}

export async function apiGetMe() {
  return apiFetch('/auth/me');
}

export async function apiGetWeather(lat: number, lon: number) {
  return apiFetch(`/weather/current?lat=${lat}&lon=${lon}`);
}

export async function apiGetWeatherForecast(lat: number, lon: number) {
  return apiFetch(`/weather/forecast?lat=${lat}&lon=${lon}`);
}

export async function apiScanReceipt(formData: FormData) {
  // Note: tidak pakai Content-Type JSON — biarkan browser set multipart/form-data
  const token = (() => {
    try {
      const raw = localStorage.getItem('pavey_state');
      if (!raw) return null;
      const state = JSON.parse(raw);
      return state.accessToken ?? null;
    } catch { return null; }
  })();

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/receipt/scan`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 401) {
    localStorage.removeItem('pavey_state');
    window.location.href = '/onboarding';
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Receipt scan failed');
  return data;
}

export async function apiSaveOnboarding(data: {
  name: string;
  vibe: string;
  budget: number;
  destinations: string[];
}) {
  return apiFetch('/auth/onboarding', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiGetChatHistory(tripId: string) {
  // Gunakan apiFetchSafe karena chat history bisa diakses saat guest/auth opsional
  return apiFetchSafe(`/chatbot/history/${tripId}`);
}

export async function apiSavePlace(place: any) {
  return apiFetch('/saved-places/', {
    method: 'POST',
    body: JSON.stringify({ place }),
  });
}

export async function apiGetSavedPlaces() {
  return apiFetch('/saved-places/');
}

export async function apiDeleteSavedPlace(name: string) {
  return apiFetch(`/saved-places/name/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

export async function apiGetUserPreferences() {
  return apiFetch('/trips/preferences/history');
}

export async function apiGeneratePlan(data: {
  city: string;
  vibe: string;
  budget: number;
  days: number;
  arrival_time?: string;
  departure_time?: string;
}) {
  // Use apiFetchSafe — generate-plan is accessible to guests (no auth required).
  // Using apiFetch would redirect guests to /onboarding on 401.
  return apiFetchSafe('/trips/generate-plan', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiGenerateTripItinerary(tripId: string) {
  return apiFetch(`/trips/${tripId}/generate`, {
    method: 'POST',
  });
}

