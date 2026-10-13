// Nom d'un collaborateur tel qu'il est enregistré : "NOM Prénom" (le NOM d'abord,
// comme dans l'inventaire). Les deux champs de saisie sont réunis ici.
export function fullName(last, first) {
    return `${String(last || '').trim()} ${String(first || '').trim()}`.replace(/\s+/g, ' ').trim();
}
