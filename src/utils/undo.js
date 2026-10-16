// Rollback : au lieu de copier toute la base avant chaque action, on ne garde
// que ce que l'action a changé (les anciennes valeurs), ce qui reste léger même
// avec des milliers d'appareils. Annuler = réappliquer ces anciennes valeurs.

// Parties de l'état indexées par clé (stock par article, appareils par n° de série...).
const OBJECT_PARTS = ['stock', 'devices', 'modelAliases'];

function diffObject(previous = {}, current = {}) {
    if (previous === current) return null;
    const set = {};
    const remove = [];
    for (const key of Object.keys(previous)) {
        if (!(key in current) || current[key] !== previous[key]) set[key] = previous[key];
    }
    for (const key of Object.keys(current)) {
        if (!(key in previous)) remove.push(key);
    }
    return Object.keys(set).length || remove.length ? { set, remove } : null;
}

function applyObject(current = {}, patch) {
    if (!patch) return current;
    const next = { ...current };
    patch.remove.forEach(key => { delete next[key]; });
    Object.assign(next, patch.set);
    return next;
}

// Liste d'éléments identifiés par `id` (les attributions). Les actions de l'appli
// ajoutent en fin de liste, retirent ou remplacent sur place : on note donc les
// éléments ajoutés (à retirer), remplacés (ancienne valeur) et retirés (à
// réinsérer à leur position d'origine).
function diffList(previous = [], current = []) {
    if (previous === current) return null;
    const currentById = new Map(current.map(item => [item.id, item]));
    const previousIds = new Set(previous.map(item => item.id));
    const set = {};
    const insert = [];
    previous.forEach((item, index) => {
        if (!currentById.has(item.id)) insert.push({ index, item });
        else if (currentById.get(item.id) !== item) set[item.id] = item;
    });
    const remove = current.filter(item => !previousIds.has(item.id)).map(item => item.id);
    return Object.keys(set).length || insert.length || remove.length ? { set, remove, insert } : null;
}

function applyList(current = [], patch) {
    if (!patch) return current;
    const removed = new Set(patch.remove.map(String));
    const next = current
        .filter(item => !removed.has(String(item.id)))
        .map(item => (Object.prototype.hasOwnProperty.call(patch.set, item.id) ? patch.set[item.id] : item));
    [...patch.insert].sort((a, b) => a.index - b.index).forEach(({ index, item }) => next.splice(index, 0, item));
    return next;
}

// Ce qu'il faut pour revenir de `current` à `previous`.
export function diffState(previous, current) {
    const patch = {};
    for (const part of OBJECT_PARTS) {
        const diff = diffObject(previous[part], current[part]);
        if (diff) patch[part] = diff;
    }
    const loans = diffList(previous.loans, current.loans);
    if (loans) patch.loans = loans;
    const history = diffHistory(previous.history || [], current.history || []);
    if (history) patch.history = history;
    if (previous.notePresets !== current.notePresets) patch.notePresets = previous.notePresets || [];
    return patch;
}

// Une action ajoute ses lignes en tête de l'historique (et la plus ancienne peut
// tomber en fin de liste) : on note seulement combien en retirer en tête et ce qu'il
// faut remettre en fin. Sinon (cas imprévu), l'ancienne liste entière.
function diffHistory(previous, current) {
    if (previous === current) return null;
    const head = previous.length === 0 ? current.length : current.indexOf(previous[0]);
    if (head < 0) return previous;
    const kept = current.length - head;
    for (let i = 0; i < kept; i++) {
        if (current[head + i] !== previous[i]) return previous;
    }
    return { head, tail: previous.slice(kept) };
}

function applyHistory(current = [], patch) {
    if (Array.isArray(patch)) return patch;
    return [...current.slice(patch.head), ...patch.tail];
}

// Applique un patch produit par diffState à l'état qui a suivi l'action.
export function applyUndoPatch(state, patch) {
    const next = { ...state };
    for (const part of OBJECT_PARTS) {
        if (patch[part]) next[part] = applyObject(state[part], patch[part]);
    }
    if (patch.loans) next.loans = applyList(state.loans, patch.loans);
    if (patch.history) next.history = applyHistory(state.history, patch.history);
    if (patch.notePresets) next.notePresets = patch.notePresets;
    return next;
}
