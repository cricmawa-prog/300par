import { auth } from '../firebase';

// Calls one of our /api routes as the signed-in user (Firebase ID token in the Authorization
// header). Throws an Error carrying the server's message on any non-2xx response.
export async function api(path, { method = 'POST', body, signedOut = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const user = auth.currentUser;
    if (user && !signedOut) headers.Authorization = `Bearer ${await user.getIdToken()}`;
    let res;
    try {
        res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
        throw new Error('Network problem - check your connection and try again.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
    return data;
}

export const tournamentAction = (id, action, extra = {}) => api(`/api/tournaments/${id}`, { body: { action, ...extra } });
