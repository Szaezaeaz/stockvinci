// Pour chaque téléphone, indique si la coque et la vitre sont vendues/reçues
// ensemble (un seul article à suivre) ou séparément (deux articles distincts).
export const PHONE_CASE_INFO = {
    'iPhone 16e': { bundled: true, comboItem: 'Coque+Vitre iPhone 16e' },
    'iPhone 17': { bundled: true, comboItem: 'Coque+Vitre iPhone 17' },
    'Samsung A36': { bundled: true, comboItem: 'Coque+Vitre Samsung A36' },
    'Samsung XCOVER 7': { bundled: false, caseItem: 'Coque Samsung XCOVER 7', screenItem: 'Vitre Samsung XCOVER 7' },
};

export const PHONE_MODEL_OPTIONS = Object.keys(PHONE_CASE_INFO);
