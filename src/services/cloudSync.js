const PASSCODE_KEY = 'vinci_passcode';
const META_KEY = 'vinci_sync_meta';
const ENDPOINT = '/api/inventory';

export const getPasscode = () => localStorage.getItem(PASSCODE_KEY) || '';
export const savePasscode = (code) => localStorage.setItem(PASSCODE_KEY, code);

// meta = { rev, dirty } : révision du cloud sur laquelle cet appareil est
// basé, et présence de modifications locales pas encore envoyées.
export function loadSyncMeta() {
    try {
        const meta = JSON.parse(localStorage.getItem(META_KEY));
        return { rev: Number(meta?.rev) || 0, dirty: Boolean(meta?.dirty) };
    } catch {
        return { rev: 0, dirty: false };
    }
}

export const saveSyncMeta = (meta) => localStorage.setItem(META_KEY, JSON.stringify(meta));

// Retourne { status, body } ; status 0 = réseau indisponible.
async function request(method, payload) {
    try {
        const response = await fetch(ENDPOINT, {
            method,
            headers: { 'Content-Type': 'application/json', 'x-passcode': getPasscode() },
            body: payload ? JSON.stringify(payload) : undefined
        });
        const body = await response.json().catch(() => ({}));
        return { status: response.status, body };
    } catch {
        return { status: 0, body: {} };
    }
}

export const fetchCloud = () => request('GET');
export const pushCloud = (data, baseRev) => request('PUT', { data, baseRev });
