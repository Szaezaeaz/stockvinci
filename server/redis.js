// Accès à Upstash Redis (API REST). Variables d'environnement ajoutées par
// l'intégration Upstash de Vercel : KV_REST_API_URL / KV_REST_API_TOKEN (ou
// UPSTASH_REDIS_REST_URL / _TOKEN).
const redisUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const redisConfigured = () => Boolean(redisUrl() && redisToken());

async function post(path, body) {
    const response = await fetch(redisUrl() + path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${redisToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const json = await response.json();
    if (!response.ok || json.error) throw new Error(json.error || `Redis HTTP ${response.status}`);
    return json;
}

// Une commande : ['GET', 'clé'].
export async function redis(command) {
    return (await post('', command)).result;
}

// Plusieurs commandes en un seul aller-retour ; renvoie leurs résultats dans l'ordre.
// Un document d'inventaire ne doit apparaître qu'une fois par appel (taille limitée).
export async function pipeline(commands) {
    const results = await post('/pipeline', commands);
    return results.map(item => {
        if (item.error) throw new Error(item.error);
        return item.result;
    });
}
