import {
    DEVICES_KEY, LIMITS, USERS_KEY, authenticate, bearerToken, cleanName, clientIp, createSession, deleteSession,
    deviceSecret, failKeys, findDevice, findUserByName, loadDevices, loadUsers, masterMatches, nameKey, newDevice,
    newUserId, parseUsers, pinMatches, publicUser, recordFailure, saveDevices, saveUsers, send, serverConfigured,
    setPin, tooManyFailures, validName, validPin, withPendingDevice
} from '../server/auth.js';
import { redis } from '../server/redis.js';

// Connexion à l'appli.
// L'appareil se présente avec son secret (en-tête x-device).
//   GET -> { configured, device: 'approved' | 'pending' | 'unknown', code? }
//   POST { action: 'request-device', label } -> { device: 'pending', code } : demande
//        d'autorisation, à approuver par un administrateur (api/devices)
//   POST { action: 'login', name, pin }            -> { token, user } (appareil approuvé)
//   POST { action: 'logout' }                      (jeton)
//   POST { action: 'setup', masterCode, name, pin } -> { token, user } : crée (ou rétablit)
//        un administrateur avec le code maître (INVENTORY_PASSCODE)
//   POST { action: 'change-pin', currentPin, newPin } (jeton) -> { token, user }
// Les noms de l'équipe ne sont jamais renvoyés sans connexion.
export default async function handler(req, res) {
    if (!serverConfigured()) return send(res, 503, { error: 'not_configured' });

    try {
        if (req.method === 'GET') {
            const [rawUsers, rawDevices] = await redis(['MGET', USERS_KEY, DEVICES_KEY]);
            const device = findDevice(parseUsers(rawDevices), deviceSecret(req));
            return send(res, 200, {
                configured: parseUsers(rawUsers).some(user => user.active && user.role === 'admin'),
                device: device ? device.status : 'unknown',
                ...(device?.status === 'pending' ? { code: device.code } : {})
            });
        }
        if (req.method !== 'POST') {
            res.setHeader('Allow', 'GET, POST');
            return send(res, 405, { error: 'method_not_allowed' });
        }

        const body = req.body || {};
        const ip = clientIp(req);
        const secret = deviceSecret(req);

        if (body.action === 'request-device') {
            if (!secret) return send(res, 400, { error: 'bad_device' });
            const devices = await loadDevices();
            const known = findDevice(devices, secret);
            if (known) return send(res, 200, { device: known.status, ...(known.status === 'pending' ? { code: known.code } : {}) });
            const limitKey = `vinci_device_req:${ip}`;
            if (await tooManyFailures([[limitKey, LIMITS.deviceRequest]])) return send(res, 429, { error: 'too_many' });
            await recordFailure([limitKey]);
            const device = newDevice(secret, body.label);
            await saveDevices(withPendingDevice(devices, device));
            return send(res, 200, { device: 'pending', code: device.code });
        }

        if (body.action === 'login') {
            const name = cleanName(body.name);
            if (await tooManyFailures([[failKeys.ip(ip), LIMITS.ip], [failKeys.name(name), LIMITS.name]])) {
                return send(res, 429, { error: 'too_many' });
            }
            // Appareil non approuvé : le code n'est même pas examiné.
            const devices = await loadDevices();
            const device = findDevice(devices, secret);
            if (!device || device.status !== 'approved') return send(res, 403, { error: 'device_not_approved' });

            const users = await loadUsers();
            const user = findUserByName(users, name);
            if (!pinMatches(user, body.pin)) {
                await recordFailure([failKeys.ip(ip), failKeys.name(name)]);
                return send(res, 401, { error: 'bad_credentials' });
            }
            await redis(['DEL', failKeys.name(name)]);
            const now = new Date().toISOString();
            await saveUsers(users.map(other => (other.id === user.id ? { ...other, lastLoginAt: now } : other)));
            await saveDevices(devices.map(other => (other.id === device.id ? { ...other, lastSeenAt: now } : other)));
            return send(res, 200, { token: await createSession(user, device), user: publicUser(user) });
        }

        if (body.action === 'logout') {
            await deleteSession(bearerToken(req));
            return send(res, 200, { ok: true });
        }

        if (body.action === 'setup') {
            if (await tooManyFailures([[failKeys.ip(ip), LIMITS.ip], [failKeys.master(), LIMITS.master]])) {
                return send(res, 429, { error: 'too_many' });
            }
            if (!masterMatches(body.masterCode)) {
                await recordFailure([failKeys.ip(ip), failKeys.master()]);
                return send(res, 401, { error: 'bad_master' });
            }
            const name = cleanName(body.name);
            if (!validName(name)) return send(res, 400, { error: 'bad_name' });
            if (!validPin(body.pin)) return send(res, 400, { error: 'bad_pin' });
            if (!secret) return send(res, 400, { error: 'bad_device' });

            const users = await loadUsers();
            const existing = users.find(user => nameKey(user.name) === nameKey(name));
            const now = new Date().toISOString();
            const admin = existing
                ? setPin({ ...existing, name, role: 'admin', active: true, version: (existing.version || 1) + 1, lastLoginAt: now }, body.pin)
                : setPin({ id: newUserId(), name, role: 'admin', active: true, version: 1, createdAt: now, lastLoginAt: now }, body.pin);
            await saveUsers(existing ? users.map(user => (user.id === admin.id ? admin : user)) : [...users, admin]);
            // Le code maître vaut aussi autorisation de cet appareil.
            const devices = await loadDevices();
            const known = findDevice(devices, secret);
            const device = known
                ? { ...known, status: 'approved', approvedBy: name, lastSeenAt: now }
                : { ...newDevice(secret, body.deviceLabel || `Appareil de ${name}`, 'approved', name), lastSeenAt: now };
            await saveDevices(known ? devices.map(other => (other.id === device.id ? device : other)) : [...devices, device]);
            return send(res, 200, { token: await createSession(admin, device), user: publicUser(admin) });
        }

        if (body.action === 'change-pin') {
            const { user, users, device } = await authenticate(req);
            if (!user) return send(res, 401, { error: 'unauthorized' });
            if (!pinMatches(user, body.currentPin)) {
                await recordFailure([failKeys.ip(ip), failKeys.name(user.name)]);
                return send(res, 403, { error: 'bad_credentials' });
            }
            if (!validPin(body.newPin)) return send(res, 400, { error: 'bad_pin' });
            const updated = setPin({ ...user, version: user.version + 1 }, body.newPin);
            await saveUsers(users.map(other => (other.id === user.id ? updated : other)));
            await deleteSession(bearerToken(req));
            return send(res, 200, { token: await createSession(updated, device), user: publicUser(updated) });
        }

        return send(res, 400, { error: 'bad_action' });
    } catch (err) {
        console.error('auth api error', err);
        return send(res, 500, { error: 'server_error' });
    }
}
