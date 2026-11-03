import { randomBytes } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pipeline, redis } from './redis.js';

// Inventaire dans Redis, et ses sauvegardes.
//
//   KEY     : le document { z, rev } où z = inventaire en JSON compressé (gzip,
//             base64). Les documents écrits avant la compression sont { data, rev }.
//   REV_KEY : le numéro de révision seul (les appareils le comparent chaque minute).
//
// Sauvegardes ('vinci_backup:<id>', même format que KEY), listées dans l'ensemble
// trié BACKUPS_KEY (score = date, membre = description JSON) :
//   - 'auto' : l'inventaire juste après une modification, au plus une fois par
//              quart d'heure, gardé 3 jours ;
//   - 'jour' : l'inventaire avant la première modification du jour, gardé 31 jours ;
//   - 'restauration' : l'inventaire juste avant une restauration, gardé 7 jours ;
//   - 'remplacement' : l'inventaire juste avant qu'un appareil le remplace par ses
//                      propres données (choix "Remplacer le cloud"), gardé 7 jours.
// Un document d'inventaire n'est envoyé qu'une fois par requête à Redis (taille limitée).
export const KEY = 'vinci_inventory';
export const REV_KEY = 'vinci_inventory_rev';
const BACKUPS_KEY = 'vinci_backups';
const TICK_KEY = 'vinci_backup_tick';
const DAY = 86400;
const RETENTION_S = { auto: 3 * DAY, jour: 31 * DAY, restauration: 7 * DAY, remplacement: 7 * DAY };

export const pack = (data) => gzipSync(Buffer.from(JSON.stringify(data))).toString('base64');
const unpack = (z) => JSON.parse(gunzipSync(Buffer.from(z, 'base64')).toString());
const parseDoc = (raw) => {
    const doc = JSON.parse(raw);
    return { data: doc.z ? unpack(doc.z) : doc.data, rev: doc.rev };
};

export async function readStored() {
    const raw = await redis(['GET', KEY]);
    return raw ? parseDoc(raw) : null;
}

// Révision actuelle. `stored` n'est renseigné que s'il a fallu lire le document
// (document écrit avant l'existence de REV_KEY).
export async function readRev(knownRaw) {
    const raw = knownRaw !== undefined ? knownRaw : await redis(['GET', REV_KEY]);
    if (raw != null) return { rev: Number(raw) };
    const stored = await readStored();
    return { rev: stored ? stored.rev : 0, stored };
}

const summarize = (data) => ({
    devices: Object.keys(data?.devices || {}).length,
    loans: (data?.loans || []).length,
    units: Object.values(data?.stock || {}).reduce((sum, n) => sum + (Number(n) || 0), 0)
});

// Jour à Paris (AAAA-MM-JJ).
const parisDay = (date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(date);

async function saveBackup(docRaw, data, kind, by) {
    const at = Date.now();
    const id = `${at}-${randomBytes(3).toString('hex')}`;
    const meta = { id, at, kind, by: by || null, rev: JSON.parse(docRaw).rev, ...summarize(data), until: at + RETENTION_S[kind] * 1000 };
    await redis(['SET', `vinci_backup:${id}`, docRaw, 'EX', RETENTION_S[kind]]);
    await redis(['ZADD', BACKUPS_KEY, at, JSON.stringify(meta)]);
}

// Écrit l'inventaire (révision rev) en gardant les sauvegardes à jour.
// overwrite : un appareil remplace les données de l'équipe ; on garde l'état d'avant.
export async function writeInventory(data, rev, by, overwrite = false) {
    if (overwrite) {
        const previous = await redis(['GET', KEY]);
        if (previous) await saveBackup(previous, parseDoc(previous).data, 'remplacement', by);
    }

    // Première modification du jour : on garde l'état d'avant.
    const dayMark = `vinci_backup_day:${parisDay(new Date())}`;
    const [firstOfDay] = await pipeline([['SET', dayMark, '1', 'NX', 'EX', 2 * DAY]]);
    if (firstOfDay === 'OK') {
        const previous = await redis(['GET', KEY]);
        if (previous) await saveBackup(previous, parseDoc(previous).data, 'jour', by);
    }

    const docRaw = JSON.stringify({ z: pack(data), rev });
    await redis(['MSET', KEY, docRaw, REV_KEY, String(rev)]);

    const tick = await redis(['SET', TICK_KEY, '1', 'NX', 'EX', 900]);
    if (tick === 'OK') await saveBackup(docRaw, data, 'auto', by);
}

// Sauvegardes encore disponibles, les plus récentes d'abord.
export async function listBackups() {
    const members = await redis(['ZRANGE', BACKUPS_KEY, 0, -1, 'REV']);
    const now = Date.now();
    const all = members.map(member => ({ member, meta: JSON.parse(member) }));
    const expired = all.filter(({ meta }) => meta.until <= now).map(({ member }) => member);
    if (expired.length > 0) await redis(['ZREM', BACKUPS_KEY, ...expired]);
    return all.filter(({ meta }) => meta.until > now).map(({ meta }) => meta);
}

// Remet une sauvegarde en place comme nouvelle révision (l'état actuel est d'abord
// sauvegardé). Renvoie la nouvelle révision, ou null si la sauvegarde n'existe plus.
export async function restoreBackup(id, by) {
    const raw = await redis(['GET', `vinci_backup:${id}`]);
    if (!raw) return null;
    const restored = parseDoc(raw);
    const current = await redis(['GET', KEY]);
    let rev = 0;
    if (current) {
        const doc = parseDoc(current);
        rev = doc.rev;
        await saveBackup(current, doc.data, 'restauration', by);
    }
    const next = rev + 1;
    await redis(['MSET', KEY, JSON.stringify({ z: pack(restored.data), rev: next }), REV_KEY, String(next)]);
    return next;
}
