// Pour chaque téléphone, indique si la coque et la vitre sont vendues/reçues
// ensemble (un seul article à suivre) ou séparément (deux articles distincts).
export const PHONE_CASE_INFO = {
    'iPhone 16e': { bundled: true, comboItem: 'Coque+Vitre iPhone 16e' },
    'iPhone 17': { bundled: true, comboItem: 'Coque+Vitre iPhone 17' },
    'Samsung A36': { bundled: true, comboItem: 'Coque+Vitre Samsung A36' },
    'Samsung XCOVER 7': { bundled: false, caseItem: 'Coque Samsung XCOVER 7', screenItem: 'Vitre Samsung XCOVER 7' },
};

export const PHONE_MODEL_OPTIONS = Object.keys(PHONE_CASE_INFO);

// Libellés courts pour l'affichage de la carte "Coques & Vitres" (le titre de
// la carte dit déjà "Coques & Vitres", pas besoin de répéter "Coque+Vitre" sur
// chaque ligne, et "Samsung" est superflu vu le contexte téléphones).
export const PHONE_CASE_SHORT_LABELS = Object.entries(PHONE_CASE_INFO).reduce((labels, [phone, info]) => {
    const shortPhone = phone.replace('Samsung ', '');
    if (info.bundled) {
        labels[info.comboItem] = shortPhone;
    } else {
        labels[info.caseItem] = `${shortPhone} — Coque`;
        labels[info.screenItem] = `${shortPhone} — Vitre`;
    }
    return labels;
}, {});
