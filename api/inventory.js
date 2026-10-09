import { timingSafeEqual } from 'node:crypto';

// Sauvegarde cloud de l'inventaire : un seul document JSON dans Upstash Redis.
// Variables d'environnement (ajoutées par l'intégration Upstash de Vercel) :
//   KV_REST_API_URL / KV_REST_API_TOKEN  (ou UPSTASH_REDIS_REST_URL / _TOKEN)
// Code d'accès partagé : INVENTORY_PASSCODE.
const KEY = 'vinci_inventory';

const redisUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command) {
    const response = await fetch(redisUrl(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${redisToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command)
    });
    const json = await response.json();
    if (!response.ok || json.error) throw new Error(json.error || `Redis HTTP ${response.status}`);
    return json.result;
}

function passcodeMatches(provided) {
    const expected = process.env.INVENTORY_PASSCODE;
    if (!expected || typeof provided !== 'string') return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

async function readStored() {
    const raw = await redis(['GET', KEY]);
    return raw ? JSON.parse(raw) : null; // { data, rev }
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (!redisUrl() || !redisToken() || !process.env.INVENTORY_PASSCODE) {
        return res.status(503).json({ error: 'not_configured' });
    }
    if (!passcodeMatches(req.headers['x-passcode'])) {
        return res.status(401).json({ error: 'bad_passcode' });
    }

    try {
        if (req.method === 'GET') {
            const stored = await readStored();
            return res.status(200).json(stored || { data: null, rev: 0 });
        }

        if (req.method === 'PUT') {
            const { data, baseRev } = req.body || {};
            if (!data || typeof data !== 'object' || typeof baseRev !== 'number') {
                return res.status(400).json({ error: 'bad_payload' });
            }
            // Contrôle de concurrence : on n'écrit que si l'appareil est parti de la
            // dernière révision du cloud, sinon un autre appareil a écrit entre-temps
            // et on renvoie la version cloud pour qu'il la reprenne.
            const stored = await readStored();
            if (stored && stored.rev !== baseRev) {
                return res.status(409).json(stored);
            }
            const rev = (stored ? stored.rev : 0) + 1;
            await redis(['SET', KEY, JSON.stringify({ data, rev })]);
            return res.status(200).json({ rev });
        }

        res.setHeader('Allow', 'GET, PUT');
        return res.status(405).json({ error: 'method_not_allowed' });
    } catch (err) {
        console.error('inventory api error', err);
        return res.status(500).json({ error: 'server_error' });
    }
}
