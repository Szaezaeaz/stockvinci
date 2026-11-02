import {
    authenticate, cleanName, nameKey, newUserId, publicUser, saveUsers, send, serverConfigured, setPin, validName, validPin
} from '../server/auth.js';

// Gestion de l'équipe (administrateurs seulement).
//   GET                                               -> { users }
//   POST { action: 'add', name, pin, role }           -> { users }
//   POST { action: 'update', id, name?, pin?, role?, active? } -> { users }
// Un compte n'est jamais supprimé (son nom reste dans l'historique) : on le désactive.
export default async function handler(req, res) {
    if (!serverConfigured()) return send(res, 503, { error: 'not_configured' });

    try {
        const { user: me, users } = await authenticate(req);
        if (!me) return send(res, 401, { error: 'unauthorized' });
        if (me.role !== 'admin') return send(res, 403, { error: 'forbidden' });

        const list = (all) => all.map(publicUser).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

        if (req.method === 'GET') return send(res, 200, { users: list(users) });
        if (req.method !== 'POST') {
            res.setHeader('Allow', 'GET, POST');
            return send(res, 405, { error: 'method_not_allowed' });
        }

        const body = req.body || {};
        const role = body.role === 'admin' ? 'admin' : 'member';
        const nameTaken = (name, exceptId) => users.some(user => user.id !== exceptId && nameKey(user.name) === nameKey(name));

        if (body.action === 'add') {
            const name = cleanName(body.name);
            if (!validName(name)) return send(res, 400, { error: 'bad_name' });
            if (!validPin(body.pin)) return send(res, 400, { error: 'bad_pin' });
            if (nameTaken(name)) return send(res, 409, { error: 'name_taken' });
            const added = setPin({ id: newUserId(), name, role, active: true, version: 1, createdAt: new Date().toISOString() }, body.pin);
            const next = [...users, added];
            await saveUsers(next);
            return send(res, 200, { users: list(next) });
        }

        if (body.action === 'update') {
            const target = users.find(user => user.id === body.id);
            if (!target) return send(res, 404, { error: 'not_found' });
            let updated = { ...target };
            if (body.name !== undefined) {
                const name = cleanName(body.name);
                if (!validName(name)) return send(res, 400, { error: 'bad_name' });
                if (nameTaken(name, target.id)) return send(res, 409, { error: 'name_taken' });
                updated.name = name;
            }
            if (body.role !== undefined) updated.role = role;
            if (body.active !== undefined) updated.active = Boolean(body.active);
            if (body.pin !== undefined) {
                if (!validPin(body.pin)) return send(res, 400, { error: 'bad_pin' });
                updated = setPin(updated, body.pin);
            }
            // Nouveau code ou compte désactivé : ses sessions en cours sont coupées.
            if (body.pin !== undefined || (target.active && !updated.active)) updated.version = (target.version || 1) + 1;

            const next = users.map(user => (user.id === target.id ? updated : user));
            if (!next.some(user => user.active && user.role === 'admin')) return send(res, 409, { error: 'last_admin' });
            await saveUsers(next);
            return send(res, 200, { users: list(next) });
        }

        return send(res, 400, { error: 'bad_action' });
    } catch (err) {
        console.error('users api error', err);
        return send(res, 500, { error: 'server_error' });
    }
}
