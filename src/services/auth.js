// Session de l'utilisateur connecté sur cet appareil, et appels aux fonctions
// /api/auth, /api/users et /api/backups.
//
// localStorage :
//   vinci_session      : { token, user: { id, name, role } }
//   vinci_recent_users : noms des derniers comptes connectés sur CET appareil
//                        (proposés à la connexion ; le serveur ne liste jamais l'équipe)
//   vinci_last_activity: dernière activité (verrouillage après 15 min sans activité)
//   vinci_device       : secret de cet appareil, à faire autoriser par un administrateur
const DEVICE_KEY = 'vinci_device';
const SESSION_KEY = 'vinci_session';
const RECENT_KEY = 'vinci_recent_users';
const ACTIVITY_KEY = 'vinci_last_activity';
const LEGACY_PASSCODE_KEY = 'vinci_passcode';
export const IDLE_LOCK_MS = 15 * 60 * 1000;
const MAX_RECENT = 6;

// Événement envoyé quand le serveur refuse la session (expirée, code changé, compte désactivé).
export const AUTH_EXPIRED_EVENT = 'vinci-auth-expired';

const read = (key, fallback) => {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value ?? fallback;
    } catch {
        return fallback;
    }
};
const write = (key, value) => {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // stockage indisponible : la session reste en mémoire le temps de la page
    }
};

// L'ancien code d'accès partagé n'est plus utilisé : on ne le garde pas sur l'appareil.
try { localStorage.removeItem(LEGACY_PASSCODE_KEY); } catch { /* rien */ }

function deviceSecret() {
    let secret = read(DEVICE_KEY, '');
    if (!secret) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        secret = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
        write(DEVICE_KEY, secret);
    }
    return secret;
}

let session = read(SESSION_KEY, null);
export const getSession = () => session;
export const getToken = () => session?.token || '';
// Nom de la personne connectée, inscrit dans l'historique ("par …").
export const actorName = () => session?.user?.name || '';

export function saveSession(next) {
    session = next;
    write(SESSION_KEY, next);
    if (next?.user?.name) {
        const recent = read(RECENT_KEY, []).filter(name => name !== next.user.name);
        write(RECENT_KEY, [next.user.name, ...recent].slice(0, MAX_RECENT));
        markActivity(true);
    }
}

export const recentUsers = () => read(RECENT_KEY, []);
export const forgetRecentUser = (name) => write(RECENT_KEY, read(RECENT_KEY, []).filter(other => other !== name));

// --- Activité (verrouillage automatique) -----------------------------------------
let lastWrite = 0;
export function markActivity(force = false) {
    const now = Date.now();
    if (!force && now - lastWrite < 15000) return; // une écriture toutes les 15 s suffit
    lastWrite = now;
    write(ACTIVITY_KEY, now);
}
export const idleFor = () => Date.now() - (Number(read(ACTIVITY_KEY, 0)) || 0);

// --- Appels au serveur -------------------------------------------------------------
// Renvoie { status, body } ; status 0 = réseau indisponible.
export async function api(path, { method = 'GET', body, auth = true } = {}) {
    try {
        const headers = { 'Content-Type': 'application/json', 'x-device': deviceSecret() };
        if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;
        const response = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
        const json = await response.json().catch(() => ({}));
        if (auth && response.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
        return { status: response.status, body: json };
    } catch {
        return { status: 0, body: {} };
    }
}

export const authStatus = () => api('/api/auth', { auth: false });
export const login = (name, pin) => api('/api/auth', { method: 'POST', body: { action: 'login', name, pin }, auth: false });
export const requestDevice = (label) => api('/api/auth', { method: 'POST', body: { action: 'request-device', label }, auth: false });
export const setupAdmin = (masterCode, name, pin) => api('/api/auth', { method: 'POST', body: { action: 'setup', masterCode, name, pin }, auth: false });
export const changePin = (currentPin, newPin) => api('/api/auth', { method: 'POST', body: { action: 'change-pin', currentPin, newPin } });

// Déconnexion : la session est oubliée ici et supprimée sur le serveur (si joignable).
export function logout() {
    const token = getToken();
    saveSession(null);
    if (token) {
        fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-device': deviceSecret(), Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'logout' })
        }).catch(() => {});
    }
}

export const listUsers = () => api('/api/users');
export const addUser = (name, pin, role) => api('/api/users', { method: 'POST', body: { action: 'add', name, pin, role } });
export const updateUser = (id, changes) => api('/api/users', { method: 'POST', body: { action: 'update', id, ...changes } });

export const listDevices = () => api('/api/devices');
export const updateDevice = (action, id, label) => api('/api/devices', { method: 'POST', body: { action, id, label } });

export const listBackups = () => api('/api/backups');
export const restoreBackup = (id) => api('/api/backups', { method: 'POST', body: { action: 'restore', id } });

// Messages d'erreur du serveur, en clair.
export function errorMessage({ status, body }) {
    if (status === 0) return 'Pas de connexion au serveur. Vérifie le réseau.';
    switch (body?.error) {
        case 'bad_credentials': return 'Nom ou code incorrect.';
        case 'too_many': return 'Trop d’essais. Réessaie dans 15 minutes.';
        case 'bad_master': return 'Code maître incorrect.';
        case 'bad_pin': return 'Le code doit faire de 6 à 12 chiffres.';
        case 'bad_name': return 'Indique un nom (2 caractères minimum).';
        case 'name_taken': return 'Ce nom est déjà utilisé par un autre compte.';
        case 'last_admin': return 'Il doit rester au moins un administrateur actif.';
        case 'not_configured': return 'Le serveur n’est pas configuré.';
        case 'forbidden': return 'Réservé aux administrateurs.';
        case 'device_not_approved': return 'Cet appareil n’est pas autorisé.';
        case 'own_device': return 'Tu ne peux pas retirer l’appareil que tu utilises.';
        case 'not_found': return 'Introuvable (peut-être expiré).';
        default: return 'Erreur du serveur. Réessaie.';
    }
}
