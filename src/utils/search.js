// Normalise pour la recherche : minuscules, sans accents, espaces nettoyés.
function normalize(text) {
    return String(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

// Vrai si chaque mot saisi se retrouve dans au moins un des textes
// (ex. "g11 occ" retrouve "650 G11 Neuf" + sa ligne "Occasion").
export function matchesQuery(query, texts) {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    const haystack = normalize(texts.join(' '));
    return words.every(word => haystack.includes(word));
}
