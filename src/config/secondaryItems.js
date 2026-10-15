import { ALL_STOCK_ITEMS } from './items';
import { TRACKED_MODELS } from './trackedModels';

// Matériel secondaire : tout sauf les PC et téléphones, suivis par n° de série. Ceux-ci
// entrent par l'onglet Scanner d'Ajout Matériel et sortent par "Attribuer du matériel" ;
// les listes par quantité (Ajout, Sortie) ne proposent donc que le reste.
export const SECONDARY_ITEMS = ALL_STOCK_ITEMS.filter(item => !TRACKED_MODELS.has(item.id));

// Matériel secondaire proposé au retour d'une personne : la coque et la vitre d'un
// téléphone se rendent avec lui, pas dans cette liste.
export const RETURN_ITEMS = SECONDARY_ITEMS.filter(item => !/^(Coque|Vitre)/.test(item.id));
