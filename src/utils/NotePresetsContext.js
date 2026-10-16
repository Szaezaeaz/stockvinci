import { createContext } from 'react';

// Commentaires types ajoutés par l'équipe (enregistrés avec l'inventaire, donc
// communs à toutes les tablettes), et de quoi en ajouter ou en retirer.
export const NotePresetsContext = createContext({ custom: [], add: () => {}, remove: () => {} });
