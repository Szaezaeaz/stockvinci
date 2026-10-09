import { PHONE_MODEL_OPTIONS } from './phoneAccessories';

// Modèles dont chaque appareil est suivi par son n° de série.
export const PC_MODELS = [
    '650 G11 Neuf',
    '650 G11 Occasion',
    '850 G8/G10 Occasion',
    'X360 Neuf',
    'X360 Occasion',
    'Zbook Neuf',
    'Zbook Occasion'
];

export const TRACKED_MODELS = new Set([...PC_MODELS, ...PHONE_MODEL_OPTIONS]);
