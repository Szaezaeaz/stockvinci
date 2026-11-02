import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { pipeline, redis, redisConfigured } from './redis.js';

// Comptes de l'équipe et sessions.
//
// USERS_KEY : liste JSON des comptes { id, name, role: 'admin' | 'member', salt,
//   hash (scrypt du code PIN), active, version, createdAt, lastLoginAt }. Changer le
//   code ou désactiver un compte augmente `version` : ses sessions ne valent plus rien.
// Sessions : 'vinci_session:<sha256 du jeton>' -> { userId, version }, valables une
//   heure après la dernière requête (l'appli se verrouille elle-même après 15 min
//   sans activité).
// DEVICES_KEY : appareils { id, hash (sha256 du secret gardé par l'appareil), label,
//   status: 'pending' | 'approved', code (affiché sur l'appareil, comparé par
//   l'administrateur), createdAt, approvedBy, lastSeenAt }. Seul un appareil approuvé
//   peut tenter une connexion, et une session ne vaut que sur son appareil.
// INVENTORY_PASSCODE : code maître, connu du seul responsable. Il ne donne pas accès
//   aux données : il sert à créer le premier administrateur ou à en récupérer un
//   (l'appareil utilisé est alors approuvé).
export const USERS_KEY = 'vinci_users';
export const DEVICES_KEY = 'vinci_devices';
const MAX_PENDING_DEVICES = 20;
const SESSION_TTL_S = 3600;
const FAIL_WINDOW_S = 900;
export const LIMITS = { ip: 20, name: 5, master: 10, deviceRequest: 5 };

export const serverConfigured = () => redisConfigured() && Boolean(process.env.INVENTORY_PASSCODE);

// Même règle que l'appli : accents, majuscules et ponctuation ignorés.
export function nameKey(name) {
    return String(name || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

export const cleanName = (name) => String(name || '').replace(/\s+/g, ' ').trim();
export const validName = (name) => cleanName(name).length >= 2 && cleanName(name).length <= 60;
export const validPin = (pin) => typeof pin === 'string' && /^\d{6,12}$/.test(pin);

const hashPin = (pin, salt) => scryptSync(pin, salt, 32).toString('hex');

export function setPin(user, pin) {
    const salt = randomBytes(16).toString('hex');
    return { ...user, salt, hash: hashPin(pin, salt) };
}

// Compare toujours un hash, même sans compte : la réponse ne dit pas si le nom existe.
const DUMMY = setPin({}, '000000');
export function pinMatches(user, pin) {
    const target = user || DUMMY;
    const expected = Buffer.from(target.hash, 'hex');
    const actual = Buffer.from(hashPin(String(pin || ''), target.salt), 'hex');
    return Boolean(user) && expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function masterMatches(code) {
    const expected = Buffer.from(String(process.env.INVENTORY_PASSCODE || ''));
    const actual = Buffer.from(String(code || ''));
    return expected.length > 0 && expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const publicUser = (user) => ({
    id: user.id,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null
});

export const parseUsers = (raw) => {
    try {
        const users = JSON.parse(raw || '[]');
        return Array.isArray(users) ? users : [];
    } catch {
        return [];
    }
};
export const loadUsers = async () => parseUsers(await redis(['GET', USERS_KEY]));
export const saveUsers = (users) => redis(['SET', USERS_KEY, JSON.stringify(users)]);
export const newUserId = () => randomBytes(8).toString('hex');

// Compte désigné par le nom saisi : le nom exact (accents et majuscules ignorés),
// sinon le seul compte dont le nom commence par ce mot (ex. "yanis").
export function findUserByName(users, name) {
    const key = nameKey(name);
    if (!key) return null;
    const active = users.filter(user => user.active);
    const exact = active.find(user => nameKey(user.name) === key);
    if (exact) return exact;
    if (key.length < 3) return null;
    const partial = active.filter(user => nameKey(user.name).startsWith(`${key} `));
    return partial.length === 1 ? partial[0] : null;
}

// --- Appareils -----------------------------------------------------------------
const hashSecret = (secret) => createHash('sha256').update(secret).digest('hex');
export const deviceSecret = (req) => {
    const secret = String(req.headers['x-device'] || '');
    return secret.length >= 32 && secret.length <= 128 ? secret : '';
};
export const findDevice = (devices, secret) => (secret ? devices.find(device => device.hash === hashSecret(secret)) || null : null);
export const loadDevices = async () => parseUsers(await redis(['GET', DEVICES_KEY]));
export const saveDevices = (devices) => redis(['SET', DEVICES_KEY, JSON.stringify(devices)]);
export const cleanLabel = (label) => cleanName(label).slice(0, 40);

export const publicDevice = (device) => ({
    id: device.id,
    label: device.label,
    status: device.status,
    code: device.status === 'pending' ? device.code : null,
    createdAt: device.createdAt,
    approvedBy: device.approvedBy || null,
    lastSeenAt: device.lastSeenAt || null
});

// Code court sans caractères ambigus, ex. "K7F-2QM".
function newDeviceCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(6);
    const text = [...bytes].map(byte => alphabet[byte % alphabet.length]).join('');
    return `${text.slice(0, 3)}-${text.slice(3)}`;
}

export function newDevice(secret, label, status = 'pending', approvedBy = null) {
    return {
        id: newUserId(),
        hash: hashSecret(secret),
        label: cleanLabel(label) || 'Appareil',
        status,
        code: newDeviceCode(),
        createdAt: new Date().toISOString(),
        approvedBy
    };
}

// Ajoute une demande ; au-delà du maximum, les plus anciennes en attente sont retirées.
export function withPendingDevice(devices, device) {
    const next = [...devices, device];
    let excess = next.filter(other => other.status === 'pending').length - MAX_PENDING_DEVICES;
    return next.filter(other => {
        if (excess > 0 && other.status === 'pending') {
            excess--;
            return false;
        }
        return true;
    });
}

// --- Sessions ------------------------------------------------------------------
const sessionKey = (token) => `vinci_session:${createHash('sha256').update(token).digest('hex')}`;

export async function createSession(user, device) {
    const token = randomBytes(32).toString('base64url');
    await redis(['SET', sessionKey(token), JSON.stringify({ userId: user.id, version: user.version, deviceId: device.id }), 'EX', SESSION_TTL_S]);
    return token;
}

export const bearerToken = (req) => {
    const header = String(req.headers.authorization || '');
    return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
};

export async function deleteSession(token) {
    if (token) await redis(['DEL', sessionKey(token)]);
}

// Compte de la requête (jeton "Authorization: Bearer"), ou null. extraKeys : clés lues
// dans le même aller-retour (ex. la révision de l'inventaire) -> extras.
export async function authenticate(req, extraKeys = []) {
    const token = bearerToken(req);
    if (!token) return { user: null, extras: [] };
    const key = sessionKey(token);
    const [rawSession, rawUsers, rawDevices, ...extras] = await redis(['MGET', key, USERS_KEY, DEVICES_KEY, ...extraKeys]);
    if (!rawSession) return { user: null, extras };
    let session;
    try {
        session = JSON.parse(rawSession);
    } catch {
        return { user: null, extras };
    }
    const users = parseUsers(rawUsers);
    const user = users.find(other => other.id === session.userId);
    if (!user || !user.active || user.version !== session.version) return { user: null, extras };
    // La session ne vaut que sur son appareil, tant qu'il reste approuvé.
    const devices = parseUsers(rawDevices);
    const device = findDevice(devices, deviceSecret(req));
    if (!device || device.status !== 'approved' || device.id !== session.deviceId) return { user: null, extras };
    await redis(['EXPIRE', key, SESSION_TTL_S]); // la session reste valable tant qu'on s'en sert
    return { user, users, device, devices, extras };
}

// --- Essais en série ---------------------------------------------------------------
export const clientIp = (req) =>
    String(req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown').trim();

export const failKeys = {
    ip: (ip) => `vinci_fail_ip:${ip}`,
    name: (name) => `vinci_fail_name:${nameKey(name)}`,
    master: () => 'vinci_fail_master'
};

// Vrai si l'une des clés a atteint sa limite. checks : [[clé, limite], ...]
export async function tooManyFailures(checks) {
    const counts = await redis(['MGET', ...checks.map(([key]) => key)]);
    return checks.some(([, limit], index) => Number(counts[index] || 0) >= limit);
}

// Compte un échec ; la fenêtre de 15 min part du premier échec.
export async function recordFailure(keys) {
    await pipeline(keys.flatMap(key => [['SET', key, '0', 'NX', 'EX', FAIL_WINDOW_S], ['INCR', key]]));
}

// Réponse JSON commune.
export function send(res, status, body) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(status).json(body);
}
