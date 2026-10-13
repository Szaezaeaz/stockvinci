import { ALL_STOCK_ITEMS } from './items';
import { TRACKED_MODELS } from './trackedModels';

// Matériel secondaire : tout sauf les PC et téléphones, suivis par n° de série. Ceux-ci
// entrent par l'onglet Scanner d'Ajout Matériel et sortent par "Attribuer du matériel" ;
// les listes par quantité (Ajout, Sortie) ne proposent donc que le reste.
export const SECONDARY_ITEMS = ALL_STOCK_ITEMS.filter(item => !TRACKED_MODELS.has(item.id));
