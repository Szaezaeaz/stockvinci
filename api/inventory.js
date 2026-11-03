import { authenticate, send, serverConfigured } from '../server/auth.js';
import { REV_KEY, readRev, readStored, writeInventory } from '../server/inventoryStore.js';

// Sauvegarde cloud de l'inventaire (Upstash Redis), réservée aux comptes de l'équipe
// connectés (jeton "Authorization: Bearer", voir api/auth).
//   GET ?rev=N : l'inventaire { data, rev }, ou { unchanged } si l'appareil est à jour
//   PUT { data, baseRev } : nouvelle version -> { rev }, ou 409 + version du cloud
export default async function handler(req, res) {
    if (!serverConfigured()) return send(res, 503, { error: 'not_configured' });

    try {
        // La session et la révision sont lues en un seul aller-retour.
        const { user, extras } = await authenticate(req, [REV_KEY]);
        if (!user) return send(res, 401, { error: 'unauthorized' });

        if (req.method === 'GET') {
            const current = await readRev(extras[0]);
            // ?rev=N : l'appareil indique la révision qu'il a déjà ; si c'est toujours
            // la bonne, on répond sans renvoyer l'inventaire.
            const known = Number(req.query?.rev);
            if (current.rev > 0 && known === current.rev) {
                return send(res, 200, { unchanged: true, rev: current.rev });
            }
            const stored = current.stored !== undefined ? current.stored : await readStored();
            return send(res, 200, stored || { data: null, rev: 0 });
        }

        if (req.method === 'PUT') {
            const { data, baseRev, overwrite } = req.body || {};
            if (!data || typeof data !== 'object' || typeof baseRev !== 'number') {
                return send(res, 400, { error: 'bad_payload' });
            }
            // Contrôle de concurrence : on n'écrit que si l'appareil est parti de la
            // dernière révision du cloud, sinon un autre appareil a écrit entre-temps
            // et on renvoie la version cloud pour qu'il la reprenne.
            const current = await readRev(extras[0]);
            if (current.rev > 0 && current.rev !== baseRev) {
                const stored = current.stored !== undefined ? current.stored : await readStored();
                if (stored) return send(res, 409, stored);
            }
            const rev = current.rev + 1;
            await writeInventory(data, rev, user.name, overwrite === true);
            return send(res, 200, { rev });
        }

        res.setHeader('Allow', 'GET, PUT');
        return send(res, 405, { error: 'method_not_allowed' });
    } catch (err) {
        console.error('inventory api error', err);
        return send(res, 500, { error: 'server_error' });
    }
}
