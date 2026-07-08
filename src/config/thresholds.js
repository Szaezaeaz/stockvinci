import { PHONE_CASE_INFO } from './phoneAccessories';

// Seuils par catégorie : { max, threshold }.
// - threshold ("seuil critique") : en dessous, l'article est affiché en
//   alerte et un email est envoyé. 0 désactive l'alerte.
// - max ("seuil max") : plafond utilisé dans Ajout Matériel et pour la
//   longueur des barres de niveau.
const CATEGORY_LIMITS = {
    // PC (Neuf uniquement : les PC d'occasion n'ont ni seuil ni max, voir
    // UNLIMITED_CATEGORIES ci-dessous)
    '650 G11 Neuf': { max: 50, threshold: 30 },
    'X360 Neuf': { max: 4, threshold: 1 },
    'Zbook Neuf': { max: 4, threshold: 2 },
    // Téléphones
    'iPhone 16e': { max: 15, threshold: 5 },
    'iPhone 17': { max: 2, threshold: 1 },
    'Samsung XCOVER 7': { max: 20, threshold: 5 },
    'Samsung A36': { max: 5, threshold: 2 },
    // Accessoires
    Casque: { max: 10, threshold: 2 },
    Clavier: { max: 10, threshold: 2 },
    Sacoche: { max: 20, threshold: 6 },
    Souris: { max: 20, threshold: 6 },
    'Sac à Dos': { max: 5, threshold: 1 },
    Dock: { max: 10, threshold: 3 },
    Écran: { max: 10, threshold: 3 },
    Chargeur: { max: 20, threshold: 6 },
};

// Coques/vitres : mêmes seuils que le téléphone associé.
for (const [phone, info] of Object.entries(PHONE_CASE_INFO)) {
    const phoneLimits = CATEGORY_LIMITS[phone];
    if (!phoneLimits) continue;
    if (info.bundled) {
        CATEGORY_LIMITS[info.comboItem] = phoneLimits;
    } else {
        CATEGORY_LIMITS[info.caseItem] = phoneLimits;
        CATEGORY_LIMITS[info.screenItem] = phoneLimits;
    }
}

// PC d'occasion : ni seuil critique ni stock max, juste un suivi de
// quantité simple (affiché en sous-ligne sous leur modèle Neuf).
const UNLIMITED_CATEGORIES = new Set([
    '650 G11 Occasion',
    '850 G8/G10 Occasion',
    'X360 Occasion',
    'Zbook Occasion',
]);

// Seuils par défaut pour toute catégorie non listée ci-dessus.
const DEFAULT_LIMITS = { max: 40, threshold: 10 };

function getLimits(category) {
    return CATEGORY_LIMITS[category] || DEFAULT_LIMITS;
}

export function hasStockLimits(category) {
    return !UNLIMITED_CATEGORIES.has(category);
}

export function getLowStockThreshold(category) {
    if (UNLIMITED_CATEGORIES.has(category)) return 0;
    return getLimits(category).threshold;
}

export function getMaxStock(category) {
    if (UNLIMITED_CATEGORIES.has(category)) return Infinity;
    return getLimits(category).max;
}

// Statut visuel d'une catégorie (couleur + longueur de la barre de niveau,
// exprimée par rapport au max). Le statut reste basé sur le seuil critique
// (indépendant du max) ; un seuil à 0 désactive l'email mais on garde
// quand même un repère visuel. Les catégories sans limite (PC d'occasion)
// n'ont pas de barre significative : on renvoie juste rupture ou non.
export function getStockStatus(category, count) {
    if (UNLIMITED_CATEGORIES.has(category)) {
        return { status: count <= 0 ? 'out' : 'ok', percent: 0 };
    }

    const threshold = getLowStockThreshold(category);
    const max = getMaxStock(category);
    const percent = Math.min(100, Math.round((count / max) * 100));

    let status = 'ok';
    if (count <= 0) status = 'out';
    else if (threshold > 0 && count < threshold) status = 'low';

    return { status, percent: Math.max(percent, count > 0 ? 4 : 0) };
}
