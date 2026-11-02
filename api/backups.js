import { authenticate, send, serverConfigured } from '../server/auth.js';
import { listBackups, restoreBackup } from '../server/inventoryStore.js';

// Sauvegardes de l'inventaire côté serveur (administrateurs seulement).
//   GET                                -> { backups: [{ id, at, kind, by, rev, devices, loans, units }] }
//   POST { action: 'restore', id }     -> { rev } : la sauvegarde devient la version actuelle
export default async function handler(req, res) {
    if (!serverConfigured()) return send(res, 503, { error: 'not_configured' });

    try {
        const { user } = await authenticate(req);
        if (!user) return send(res, 401, { error: 'unauthorized' });
        if (user.role !== 'admin') return send(res, 403, { error: 'forbidden' });

        if (req.method === 'GET') return send(res, 200, { backups: await listBackups() });

        if (req.method === 'POST' && req.body?.action === 'restore') {
            const rev = await restoreBackup(String(req.body.id || ''), user.name);
            if (rev === null) return send(res, 404, { error: 'not_found' });
            return send(res, 200, { rev });
        }

        res.setHeader('Allow', 'GET, POST');
        return send(res, 405, { error: 'method_not_allowed' });
    } catch (err) {
        console.error('backups api error', err);
        return send(res, 500, { error: 'server_error' });
    }
}
