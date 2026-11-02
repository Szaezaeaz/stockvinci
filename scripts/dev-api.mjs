// Serveur de développement : fait tourner les fonctions de /api en local, avec un
// Redis simulé en mémoire (aucune donnée réelle). Vite lui renvoie les appels /api
// (voir vite.config.js).
//   node scripts/dev-api.mjs        -> http://localhost:8787
// Code maître de test : "dev-master" (variable DEV_MASTER_CODE pour en changer).
import http from 'node:http';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const PORT = 8787;
process.env.KV_REST_API_URL = `http://localhost:${PORT}/redis`;
process.env.KV_REST_API_TOKEN = 'dev';
process.env.INVENTORY_PASSCODE = process.env.DEV_MASTER_CODE || 'dev-master';

// --- Redis en mémoire (les commandes utilisées par l'appli) -------------------------
const store = new Map(); // clé -> { value, expires }
const zsets = new Map(); // clé -> Map(membre -> score)
const live = (key) => {
    const entry = store.get(key);
    if (entry && entry.expires && entry.expires <= Date.now()) store.delete(key);
    return store.get(key);
};
function run([name, ...args]) {
    const cmd = String(name).toUpperCase();
    switch (cmd) {
        case 'GET': return live(args[0])?.value ?? null;
        case 'MGET': return args.map(key => live(key)?.value ?? null);
        case 'SET': {
            const [key, value, ...opts] = args;
            const upper = opts.map(String).map(o => o.toUpperCase());
            if (upper.includes('NX') && live(key)) return null;
            const ex = upper.indexOf('EX');
            store.set(key, { value: String(value), expires: ex >= 0 ? Date.now() + Number(opts[ex + 1]) * 1000 : 0 });
            return 'OK';
        }
        case 'MSET':
            for (let i = 0; i < args.length; i += 2) store.set(args[i], { value: String(args[i + 1]), expires: 0 });
            return 'OK';
        case 'DEL': return args.filter(key => store.delete(key)).length;
        case 'EXPIRE': {
            const entry = live(args[0]);
            if (!entry) return 0;
            entry.expires = Date.now() + Number(args[1]) * 1000;
            return 1;
        }
        case 'INCR': {
            const entry = live(args[0]) || { value: '0', expires: 0 };
            entry.value = String(Number(entry.value) + 1);
            store.set(args[0], entry);
            return Number(entry.value);
        }
        case 'ZADD': {
            const set = zsets.get(args[0]) || new Map();
            set.set(String(args[2]), Number(args[1]));
            zsets.set(args[0], set);
            return 1;
        }
        case 'ZRANGE': {
            const set = zsets.get(args[0]) || new Map();
            const sorted = [...set.entries()].sort((a, b) => a[1] - b[1]).map(([member]) => member);
            return args.map(String).some(a => a.toUpperCase() === 'REV') ? sorted.reverse() : sorted;
        }
        case 'ZREM': {
            const set = zsets.get(args[0]) || new Map();
            return args.slice(1).filter(member => set.delete(member)).length;
        }
        default: throw new Error(`ERR unknown command ${cmd}`);
    }
}

// --- Fonctions /api ------------------------------------------------------------------
const apiDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'api');
const handlers = {};
for (const file of readdirSync(apiDir).filter(f => f.endsWith('.js'))) {
    handlers[file.slice(0, -3)] = (await import(pathToFileURL(path.join(apiDir, file)).href)).default;
}

const readBody = (req) => new Promise(resolve => {
    let text = '';
    req.on('data', chunk => { text += chunk; });
    req.on('end', () => resolve(text));
});

http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const text = await readBody(req);
    const json = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
    };

    if (url.pathname.startsWith('/redis')) {
        try {
            const body = JSON.parse(text);
            if (url.pathname === '/redis/pipeline') {
                return json(200, body.map(command => {
                    try { return { result: run(command) }; } catch (e) { return { error: e.message }; }
                }));
            }
            return json(200, { result: run(body) });
        } catch (e) {
            return json(400, { error: e.message });
        }
    }

    const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    const handler = handlers[name];
    if (!handler) return json(404, { error: 'not_found' });

    req.query = Object.fromEntries(url.searchParams);
    try { req.body = text ? JSON.parse(text) : undefined; } catch { req.body = undefined; }
    let status = 200;
    res.status = (code) => { status = code; return res; };
    res.json = (body) => json(status, body);
    try {
        await handler(req, res);
    } catch (e) {
        console.error(e);
        json(500, { error: 'dev_server_error' });
    }
}).listen(PORT, () => console.log(`API de développement sur http://localhost:${PORT} (code maître : ${process.env.INVENTORY_PASSCODE})`));
