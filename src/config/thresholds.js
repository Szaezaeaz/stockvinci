import { PHONE_CASE_INFO } from './phoneAccessories';

// Seuils par catégorie : { max, threshold }.
// - threshold ("seuil critique") : en dessous, l'article est affiché en
//   alerte et un email est envoyé. 0 désactive l'alerte.
// - max ("seuil max") : plafond utilisé dans Ajout Matériel et pour la
//   longueur des barres de niveau.
const CATEGORY_LIMITS = {
    // PC (Neuf uniquement : les PC d'occasion n'ont ni seuil ni max, voir
    // hasStockLimits ci-dessous)
    'G11 Neuf': { max: 50, threshold: 30 },
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
    'Chargeur USB-C': { max: 20, threshold: 6 },
    'Chargeur téléphone': { max: 20, threshold: 5 },
    // Ancien chargeur : barre sur 50, mais pas d'alerte (seuil 0) car on les écoule sans réapprovisionner
    'Ancien chargeur': { max: 50, threshold: 0 },
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

// Catégories sans seuil critique ni stock max : tout ce qui n'a pas de limite
// définie ci-dessus. C'est le cas des PC d'occasion (affichés en sous-ligne sous
// leur modèle Neuf) et de tous les autres modèles du parc, suivis par n° de
// série mais sans alerte de réapprovisionnement.
export function hasStockLimits(category) {
    return Boolean(CATEGORY_LIMITS[category]);
}

export function getLowStockThreshold(category) {
    return CATEGORY_LIMITS[category]?.threshold ?? 0;
}

export function getMaxStock(category) {
    return CATEGORY_LIMITS[category]?.max ?? Infinity;
}

// Échelle utilisée pour la barre des catégories sans limite (PC d'occasion) :
// la barre est pleine à partir de 20 unités, sans qu'aucun seuil ne soit
// affiché ni appliqué (juste un repère visuel de remplissage).
const UNLIMITED_BAR_SCALE = 20;

// Statut visuel d'une catégorie (couleur + longueur de la barre de niveau,
// exprimée par rapport au max). Le statut reste basé sur le seuil critique
// (indépendant du max) ; un seuil à 0 désactive l'email mais on garde
// quand même un repère visuel. Les catégories sans limite (PC d'occasion)
// n'ont pas de seuil critique : seul un état "rupture" (0) est possible.
export function getStockStatus(category, count) {
    if (!hasStockLimits(category)) {
        const percent = Math.min(100, Math.round((count / UNLIMITED_BAR_SCALE) * 100));
        return { status: count <= 0 ? 'out' : 'ok', percent: Math.max(percent, count > 0 ? 4 : 0) };
    }

    const threshold = getLowStockThreshold(category);
    const max = getMaxStock(category);
    const percent = Math.min(100, Math.round((count / max) * 100));

    let status = 'ok';
    if (count <= 0) status = 'out';
    else if (threshold > 0 && count < threshold) status = 'low';

    return { status, percent: Math.max(percent, count > 0 ? 4 : 0) };
}
