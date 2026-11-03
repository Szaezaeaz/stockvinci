import { api } from './auth';

const META_KEY = 'vinci_sync_meta';
const ENDPOINT = '/api/inventory';

// meta = { rev, dirty } : révision du cloud sur laquelle cet appareil est
// basé, et présence de modifications locales pas encore envoyées.
export function loadSyncMeta() {
    try {
        const meta = JSON.parse(localStorage.getItem(META_KEY));
        return { rev: Number(meta?.rev) || 0, dirty: Boolean(meta?.dirty), overwrite: Boolean(meta?.overwrite) };
    } catch {
        return { rev: 0, dirty: false, overwrite: false };
    }
}

export const saveSyncMeta = (meta) => localStorage.setItem(META_KEY, JSON.stringify(meta));

// Les appels passent avec la session de la personne connectée (services/auth) ;
// retournent { status, body }, status 0 = réseau indisponible.
// knownRev : révision que cet appareil a déjà. Si le cloud est toujours à cette
// révision, il répond { unchanged: true } sans renvoyer tout l'inventaire.
export const fetchCloud = (knownRev = 0) => api(ENDPOINT + (knownRev > 0 ? `?rev=${knownRev}` : ''));
// overwrite : l'appareil remplace volontairement les données de l'équipe ; le serveur
// en garde d'abord une sauvegarde.
export const pushCloud = (data, baseRev, overwrite = false) => api(ENDPOINT, { method: 'PUT', body: { data, baseRev, overwrite } });
