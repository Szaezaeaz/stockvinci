// Seuil de stock bas par catégorie : en dessous de cette valeur, l'article
// est affiché en alerte et un email est envoyé. Un seuil de 0 désactive
// l'alerte pour cette catégorie (ex: PC d'occasion, pas besoin de recommander).
const CATEGORY_THRESHOLDS = {
    // PC
    '650 G11 Neuf': 5,
    '650 G11 Occasion': 0,
    '850 G8/G10 Occasion': 0,
    'Zbook Neuf': 5,
    'Zbook Occasion': 0,
    'X360 Neuf': 2,
    // Téléphones
    'iPhone 16e': 5,
    'iPhone 17': 1,
    'Samsung XCOVER 7': 5,
    'Samsung A36': 3,
    // Accessoires
    Écran: 3,
};

// Seuil par défaut pour toute catégorie non listée ci-dessus (matériel
// classique : Casque, Clavier, Souris, Sacoche, Sac à Dos, Chargeur, Dock).
const DEFAULT_THRESHOLD = 10;

export function getLowStockThreshold(category) {
    return category in CATEGORY_THRESHOLDS ? CATEGORY_THRESHOLDS[category] : DEFAULT_THRESHOLD;
}

// Statut visuel d'une catégorie (couleur + longueur de la barre de niveau).
// Sert de repère "santé du stock" à l'écran, indépendant du seuil d'alerte
// email (un seuil à 0 désactive l'email mais on garde un repère visuel).
export function getStockStatus(category, count) {
    const threshold = getLowStockThreshold(category);
    const reference = threshold > 0 ? threshold * 2 : DEFAULT_THRESHOLD;
    const percent = Math.min(100, Math.round((count / reference) * 100));

    let status = 'ok';
    if (count <= 0) status = 'out';
    else if (threshold > 0 && count < threshold) status = 'low';

    return { status, percent: Math.max(percent, count > 0 ? 4 : 0) };
}
