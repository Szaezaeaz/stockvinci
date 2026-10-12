import { MODEL_CATALOG, OCCASION_ONLY_LINES } from '../config/modelCatalog';

const BY_NAME = new Map(MODEL_CATALOG.map(entry => [entry.name, entry]));

export const catalogEntry = (name) => BY_NAME.get(name) || null;

const looksLikePhone = (name) => /iphone|samsung|galaxy|xcover|pixel|android/i.test(String(name));

// 'pc' ou 'phone'. Un modèle absent du catalogue est classé d'après son nom.
export function kindOfModel(name) {
    return catalogEntry(name)?.kind || (looksLikePhone(name) ? 'phone' : 'pc');
}

export function groupOfModel(name) {
    const entry = catalogEntry(name);
    if (entry) return entry.group;
    if (!looksLikePhone(name)) return 'PC';
    return /iphone/i.test(name) ? 'iPhone' : 'Android';
}

// Les PC de ces modèles n'existent qu'en Occasion dans le stock.
export const isOccasionOnly = (name) => OCCASION_ONLY_LINES.has(catalogEntry(name)?.line);

// Ligne de stock qui compte un appareil de ce modèle. Un PC se range en Neuf ou
// en Occasion ; un téléphone n'a qu'une ligne.
export function stockKeyOf(name, condition) {
    const entry = catalogEntry(name);
    if (kindOfModel(name) === 'phone') return entry?.line || name;
    const suffix = condition === 'Occasion' || isOccasionOnly(name) ? 'Occasion' : 'Neuf';
    return `${entry?.line || name} ${suffix}`;
}

// "650 G11 Occasion" -> "Occasion" ; '' pour une ligne sans état (téléphones).
export const conditionOfStockKey = (stockKey) => String(stockKey || '').match(/ (Neuf|Occasion)$/)?.[1] || '';

// Nom à afficher pour une ligne de stock : les lignes de l'accueil gardent leur
// nom ("650 G11 Occasion"), celles d'un modèle précis sont raccourcies.
export function stockKeyLabel(stockKey) {
    const condition = conditionOfStockKey(stockKey);
    const base = condition ? stockKey.slice(0, -condition.length - 1) : String(stockKey || '');
    return BY_NAME.has(base) ? shortModelName(base) + (condition ? ` ${condition}` : '') : String(stockKey || '');
}

// Modèle exact correspondant à une ligne de stock, quand il n'y en a qu'un
// possible (ex. "650 G11 Neuf" -> EliteBook 660 G11, mais pas "Zbook Occasion").
export function exactModelFromStockKey(stockKey) {
    const key = String(stockKey || '');
    const base = key.replace(/ (Neuf|Occasion)$/, '');
    if (BY_NAME.has(key)) return key;
    if (BY_NAME.has(base)) return base;
    const matches = MODEL_CATALOG.filter(entry => entry.line && (entry.line === key || entry.line === base));
    return matches.length === 1 ? matches[0].name : null;
}

// Nom plus court pour l'affichage : sans la marque ni les mentions génériques,
// la taille d'écran en pouces (16").
export function shortModelName(name) {
    return String(name || '')
        .replace(/^HP /, '')
        .replace(/(\d)[ -]in(ch)?\b/, '$1"')
        .replace(/ (2-in-1 )?Notebook( AI)? PC$/, '')
        .replace(/ Mobile Workstation( PC)?$/, '')
        .replace(/^Samsung Galaxy /, 'Galaxy ');
}

// Nom à afficher pour un appareil : son modèle exact s'il est connu, sinon sa
// ligne de stock.
export const deviceModelLabel = (device) => shortModelName(device?.exactModel || device?.model || '');

// Tous les modèles proposables : le catalogue, plus ceux rencontrés dans la base
// (un import peut en apporter de nouveaux).
export function listModels(devices) {
    const names = MODEL_CATALOG.map(entry => entry.name);
    const seen = new Set(names);
    Object.values(devices || {}).forEach(device => {
        if (device.exactModel && !seen.has(device.exactModel)) {
            seen.add(device.exactModel);
            names.push(device.exactModel);
        }
    });
    return names;
}

// --- Reconnaissance du nom lu dans un QR code -------------------------------
// Le QR code d'un PC HP donne un nom compact, sans espaces ni mentions
// génériques : "HPELITEBOOK660G11" pour "HP EliteBook 660 16 inch G11 Notebook PC".
// On retrouve le modèle en vérifiant que ce nom compact s'écrit en mettant bout
// à bout les mots du nom exact : les mots qui identifient le modèle (EliteBook,
// 660, G11...) sont obligatoires, les mentions génériques et la taille d'écran
// peuvent manquer.

const normalize = (text) => String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const GENERIC_WORDS = new Set(['HP', 'INCH', 'IN', 'NOTEBOOK', 'PC', 'AI', 'MOBILE', 'WORKSTATION', 'NON', 'TOUCH', 'AIO', '5G', 'GENERATION']);

function tokensOf(name) {
    const words = name.toUpperCase().split(/[^A-Z0-9.]+/).filter(Boolean);
    return words.map((word, index) => {
        const isNumber = /^[0-9.]+$/.test(word);
        const nextToSizeUnit = ['INCH', 'IN'].includes(words[index + 1]) || words[index - 1] === 'IN';
        return {
            text: word.replace(/\./g, ''),
            // taille d'écran ("16 inch", "15.6 inch", "2-in-1") ou mention générique
            optional: GENERIC_WORDS.has(word) || word.includes('.') || (isNumber && nextToSizeUnit)
        };
    });
}

const CATALOG_TOKENS = MODEL_CATALOG.map(entry => ({ name: entry.name, tokens: tokensOf(entry.name) }));

function canCompose(target, tokens) {
    let positions = new Set([0]);
    for (const token of tokens) {
        const next = new Set();
        for (const position of positions) {
            if (token.optional) next.add(position); // mot facultatif : on peut le sauter
            if (target.startsWith(token.text, position)) next.add(position + token.text.length);
        }
        positions = next;
        if (positions.size === 0) return false;
    }
    return positions.has(target.length);
}

// Associations apprises à l'usage, mises à jour par useInventory et lues au
// moment d'un scan (jamais pendant un rendu). Deux sortes de clés :
//  - le nom lu dans le QR code ("HPELITEBOOK660G11") -> modèle exact ;
//  - la référence produit ("#902F6AV") -> modèle exact, quand le nom seul
//    désigne plusieurs modèles (ex. un même nom pour le 14 et le 16 pouces).
let learnedAliases = {};
export const setLearnedAliases = (aliases) => { learnedAliases = aliases || {}; };

const productKey = (productId) => (normalize(productId) ? `#${normalize(productId)}` : '');

// Retourne { model, candidates } : `model` est le modèle exact s'il est reconnu
// sans ambiguïté ; sinon null, avec les modèles possibles dans `candidates`.
export function matchModelName(rawName, productId = '') {
    const byProduct = learnedAliases[productKey(productId)];
    if (byProduct) return { model: byProduct, candidates: [byProduct] };

    const target = normalize(rawName);
    if (!target) return { model: null, candidates: [] };

    const alias = learnedAliases[target];
    if (alias) return { model: alias, candidates: [alias] };

    const exact = MODEL_CATALOG.find(entry => normalize(entry.name) === target);
    if (exact) return { model: exact.name, candidates: [exact.name] };

    const candidates = CATALOG_TOKENS.filter(entry => canCompose(target, entry.tokens)).map(entry => entry.name);
    return { model: candidates.length === 1 ? candidates[0] : null, candidates };
}

// Clé sous laquelle retenir le modèle choisi à la main pour un QR code non
// reconnu : le nom s'il est inconnu, la référence produit s'il est ambigu.
// Retourne '' s'il n'y a rien à retenir.
export function aliasKeyToLearn({ modelName, productId, candidates = [] }) {
    if (!normalize(modelName)) return '';
    return candidates.length > 1 ? productKey(productId) : normalize(modelName);
}
