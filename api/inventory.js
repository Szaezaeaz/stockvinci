import { timingSafeEqual } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

// Sauvegarde cloud de l'inventaire dans Upstash Redis.
// Variables d'environnement (ajoutées par l'intégration Upstash de Vercel) :
//   KV_REST_API_URL / KV_REST_API_TOKEN  (ou UPSTASH_REDIS_REST_URL / _TOKEN)
// Code d'accès partagé : INVENTORY_PASSCODE.
//
// Deux clés :
//   KEY     : le document, { z, rev } où z = inventaire en JSON compressé (gzip,
//             base64). Les documents écrits avant la compression sont { data, rev }.
//   REV_KEY : le numéro de révision seul. Les appareils interrogent le cloud
//             chaque minute : comparer ce petit nombre évite de relire (et de
//             renvoyer) tout l'inventaire quand rien n'a changé.
const KEY = 'vinci_inventory';
const REV_KEY = 'vinci_inventory_rev';

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

const pack = (data) => gzipSync(Buffer.from(JSON.stringify(data))).toString('base64');
const unpack = (z) => JSON.parse(gunzipSync(Buffer.from(z, 'base64')).toString());

// Document complet, toujours rendu sous la forme { data, rev } (ou null).
async function readStored() {
    const raw = await redis(['GET', KEY]);
    if (!raw) return null;
    const doc = JSON.parse(raw);
    return { data: doc.z ? unpack(doc.z) : doc.data, rev: doc.rev };
}

// Révision actuelle sans lire le document. `stored` n'est renseigné que s'il a
// fallu le lire (document écrit avant l'existence de REV_KEY).
async function readRev() {
    const raw = await redis(['GET', REV_KEY]);
    if (raw != null) return { rev: Number(raw) };
    const stored = await readStored();
    return { rev: stored ? stored.rev : 0, stored };
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
            const current = await readRev();
            // ?rev=N : l'appareil indique la révision qu'il a déjà ; si c'est toujours
            // la bonne, on répond sans renvoyer l'inventaire.
            const known = Number(req.query?.rev);
            if (current.rev > 0 && known === current.rev) {
                return res.status(200).json({ unchanged: true, rev: current.rev });
            }
            const stored = current.stored !== undefined ? current.stored : await readStored();
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
            const current = await readRev();
            if (current.rev > 0 && current.rev !== baseRev) {
                const stored = current.stored !== undefined ? current.stored : await readStored();
                if (stored) return res.status(409).json(stored);
            }
            const rev = current.rev + 1;
            await redis(['MSET', KEY, JSON.stringify({ z: pack(data), rev }), REV_KEY, String(rev)]);
            return res.status(200).json({ rev });
        }

        res.setHeader('Allow', 'GET, PUT');
        return res.status(405).json({ error: 'method_not_allowed' });
    } catch (err) {
        console.error('inventory api error', err);
        return res.status(500).json({ error: 'server_error' });
    }
}
