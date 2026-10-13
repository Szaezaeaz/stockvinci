import { HOME_LINES, MODEL_CATALOG, OCCASION_ONLY_LINES } from '../config/modelCatalog';

// Deux façons de nommer un appareil :
//  - son modèle précis, tel que l'inventaire et le QR code le donnent
//    ("HP EliteBook 660 16 inch G11 Notebook PC") ;
//  - son modèle dans l'appli, celui qu'on affiche et qu'on compte : la ligne de
//    l'accueil dont il fait partie ("G11", "Zbook", "Samsung XCOVER 7"), ou
//    son modèle précis quand il n'a pas de ligne à l'accueil.
// Un "HP ZBook Fury 16 G11" EST un "Zbook" : même modèle, même stock.

const BY_NAME = new Map(MODEL_CATALOG.map(entry => [entry.name, entry]));

// Lignes de l'accueil : nom -> { kind, group, names: modèles précis qui en font partie }.
const LINES = new Map();
for (const entry of MODEL_CATALOG) {
    if (!entry.line) continue;
    if (!LINES.has(entry.line)) LINES.set(entry.line, { kind: entry.kind, group: entry.group, names: [] });
    LINES.get(entry.line).names.push(entry.name);
}

export const catalogEntry = (name) => BY_NAME.get(name) || null;

// Modèle dans l'appli d'un modèle précis (ou d'un nom qui l'est déjà).
export const modelOf = (name) => catalogEntry(name)?.line || String(name || '');

// Modèles précis regroupés sous un modèle de l'appli ([] s'il n'est pas une ligne de l'accueil).
export const exactNamesOf = (model) => LINES.get(model)?.names || [];

// Modèle précis d'un modèle de l'appli quand il n'y en a qu'un possible
// ("G11" -> HP EliteBook 660 16 inch G11, mais pas "Zbook" qui en regroupe plusieurs).
export function exactModelOf(name) {
    if (catalogEntry(name)) return name;
    const names = LINES.get(name)?.names;
    if (names) return names.length === 1 ? names[0] : null;
    return name || null;
}

// Modèle précis à enregistrer pour un appareil du modèle `model` : celui lu dans
// le QR code ou déjà connu (hint) s'il en fait bien partie, sinon celui du modèle
// quand il n'y en a qu'un.
export function exactModelFor(model, hint) {
    return hint && catalogEntry(hint) && modelOf(hint) === modelOf(model) ? hint : exactModelOf(model);
}

const looksLikePhone = (name) => /iphone|samsung|galaxy|xcover|pixel|android/i.test(String(name));

// 'pc' ou 'phone'. Un modèle absent du catalogue est classé d'après son nom.
export function kindOfModel(name) {
    return catalogEntry(name)?.kind || LINES.get(name)?.kind || (looksLikePhone(name) ? 'phone' : 'pc');
}

export function groupOfModel(name) {
    const known = catalogEntry(name) || LINES.get(name);
    if (known) return known.group;
    if (!looksLikePhone(name)) return 'PC';
    return /iphone/i.test(name) ? 'iPhone' : 'Android';
}

// Les PC de ces modèles n'existent qu'en Occasion dans le stock.
export const isOccasionOnly = (name) => OCCASION_ONLY_LINES.has(modelOf(name));

// Ligne de stock qui compte un appareil de ce modèle. Un PC se range en Neuf ou
// en Occasion ; un téléphone n'a qu'une ligne.
export function stockKeyOf(name, condition) {
    const model = modelOf(name);
    if (kindOfModel(name) === 'phone') return model;
    return `${model} ${condition === 'Occasion' || isOccasionOnly(name) ? 'Occasion' : 'Neuf'}`;
}

// "G11 Occasion" -> "Occasion" ; '' pour une ligne sans état (téléphones).
export const conditionOfStockKey = (stockKey) => String(stockKey || '').match(/ (Neuf|Occasion)$/)?.[1] || '';

// "G11 Occasion" -> "G11" : le modèle d'une ligne de stock.
export const baseOfStockKey = (stockKey) => String(stockKey || '').replace(/ (Neuf|Occasion)$/, '');

// Modèle exact correspondant à une ligne de stock, quand il n'y en a qu'un
// possible (ex. "G11 Neuf" -> HP EliteBook 660 16 inch G11, mais pas "Zbook Occasion").
export function exactModelFromStockKey(stockKey) {
    const key = String(stockKey || '');
    const base = baseOfStockKey(key);
    if (BY_NAME.has(key)) return key;
    if (BY_NAME.has(base)) return base;
    const names = LINES.get(key)?.names || LINES.get(base)?.names || [];
    return names.length === 1 ? names[0] : null;
}

// Nom plus court d'un modèle précis : sans la marque ni les mentions génériques,
// la taille d'écran en pouces (16").
export function shortModelName(name) {
    return String(name || '')
        .replace(/^HP /, '')
        .replace(/(\d)[ -]in(ch)?\b/, '$1"')
        .replace(/ (2-in-1 )?Notebook( AI)? PC$/, '')
        .replace(/ Mobile Workstation( PC)?$/, '')
        .replace(/^Samsung Galaxy /, 'Galaxy ');
}

// Nom à afficher pour un modèle : celui de l'appli ("G11"), ou le nom précis
// raccourci quand il n'a pas de ligne à l'accueil.
export function modelLabel(name) {
    const model = modelOf(name);
    return LINES.has(model) ? model : shortModelName(model);
}

// Nom à afficher pour une ligne de stock ("G11 Occasion").
export function stockKeyLabel(stockKey) {
    const condition = conditionOfStockKey(stockKey);
    const base = baseOfStockKey(stockKey);
    return BY_NAME.has(base) && !LINES.has(base) ? shortModelName(base) + (condition ? ` ${condition}` : '') : String(stockKey || '');
}

// Nom à afficher pour un appareil (sans son état Neuf / Occasion).
export const deviceModelLabel = (device) => modelLabel(device?.exactModel || baseOfStockKey(device?.model));

// Nom complet d'un appareil (modèle précis, raccourci) pour l'onglet Attribué ;
// l'accueil, lui, parle en lignes de stock ("G11"). Sans modèle précis connu, on
// retombe sur le nom de l'appli.
export const deviceFullName = (device) => (device?.exactModel ? shortModelName(device.exactModel) : deviceModelLabel(device));

// Tous les modèles proposables dans une liste de choix : les lignes de l'accueil
// d'abord, puis les autres modèles du catalogue, plus ceux rencontrés dans la
// base (un import peut en apporter de nouveaux).
export function listModelChoices(devices) {
    const names = [...HOME_LINES.filter(line => LINES.has(line)), ...MODEL_CATALOG.filter(entry => !entry.line).map(entry => entry.name)];
    const seen = new Set(names);
    Object.values(devices || {}).forEach(device => {
        const model = modelOf(device.exactModel);
        if (model && !seen.has(model)) {
            seen.add(model);
            names.push(model);
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

// Retourne { model, candidates } : `model` est le modèle reconnu sans ambiguïté
// (son nom précis, ou le modèle de l'appli retenu à la main pour ce QR code) ;
// sinon null, avec les modèles précis possibles dans `candidates`.
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
