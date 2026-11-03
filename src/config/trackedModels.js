import { PHONE_MODEL_OPTIONS } from './phoneAccessories';
import { SCREEN_MODEL } from '../utils/models';

// Lignes de stock de l'accueil dont chaque appareil est suivi par son n° de série.
export const PC_MODELS = [
    'G11 Neuf',
    'G11 Occasion',
    'G8/G10 Occasion',
    'X360 Neuf',
    'X360 Occasion',
    'Zbook Neuf',
    'Zbook Occasion'
];

// Les écrans aussi (une seule ligne, sans modèle).
export const TRACKED_MODELS = new Set([...PC_MODELS, ...PHONE_MODEL_OPTIONS, SCREEN_MODEL]);
