// Nom d'un collaborateur tel qu'il est enregistré : "NOM Prénom" (le NOM d'abord,
// comme dans l'inventaire). Les deux champs de saisie sont réunis ici.
export function fullName(last, first) {
    return `${String(last || '').trim()} ${String(first || '').trim()}`.replace(/\s+/g, ' ').trim();
}

// Identité d'une personne : le même nom écrit avec ou sans accents, en majuscules ou
// en minuscules, avec un tiret ou une espace, désigne la même personne.
export function nameKey(name) {
    return String(name || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

const isUpperWord = (word) => word === word.toUpperCase() && word !== word.toLowerCase();

// "ROYER DE LA BASTIE Quentin" -> { last: "ROYER DE LA BASTIE", first: "Quentin" } :
// le NOM est la suite de mots en majuscules du début, le prénom le reste. Un nom
// entièrement en majuscules garde son dernier mot comme prénom.
export function splitName(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) return { last: words.join('').toUpperCase(), first: '' };
    let cut = words.findIndex(word => !isUpperWord(word));
    if (cut === -1) cut = words.length - 1;
    if (cut === 0) cut = 1;
    return { last: words.slice(0, cut).join(' ').toUpperCase(), first: words.slice(cut).join(' ') };
}

// Orthographe déjà enregistrée de chaque personne : clé d'identité -> nom. Les
// attributions passent avant les fiches d'appareils.
export function nameIndex(loans = [], devices = {}) {
    const index = new Map();
    const add = (name) => {
        const key = nameKey(name);
        if (key && !index.has(key)) index.set(key, String(name).trim());
    };
    loans.forEach(loan => add(loan.name || loan.recipient));
    Object.values(devices).forEach(device => add(device.holder));
    return index;
}

// Nom à enregistrer : l'orthographe déjà connue de cette personne s'il y en a une,
// sinon le nom tel que saisi.
export const canonicalName = (name, index) => index.get(nameKey(name)) || String(name || '').trim();

// Personnes connues, pour proposer leur nom pendant la saisie.
export function listPeople(loans = [], devices = {}) {
    const people = new Map();
    const add = (name) => {
        const key = nameKey(name);
        if (!key) return null;
        if (!people.has(key)) {
            const { last, first } = splitName(name);
            people.set(key, { name: String(name).trim(), last, first, lastKey: nameKey(last), firstKey: nameKey(first), devices: 0 });
        }
        return people.get(key);
    };
    loans.forEach(loan => add(loan.name || loan.recipient));
    Object.values(devices).forEach(device => {
        if (device.status === 'assigned' && device.holder) add(device.holder).devices++;
    });
    return [...people.values()];
}

// Personnes dont le nom contient ce qui est saisi dans NOM et Prénom, celles qui
// commencent par la saisie d'abord.
export function findPeople(people, last, first, limit = 6) {
    const lastKey = nameKey(last);
    const firstKey = nameKey(first);
    if (lastKey.length + firstKey.length < 2) return [];
    const scored = [];
    for (const person of people) {
        if (lastKey && !person.lastKey.includes(lastKey)) continue;
        if (firstKey && !person.firstKey.includes(firstKey)) continue;
        const score = (lastKey && !person.lastKey.startsWith(lastKey) ? 1 : 0) + (firstKey && !person.firstKey.startsWith(firstKey) ? 1 : 0);
        scored.push({ person, score });
    }
    return scored
        .sort((a, b) => a.score - b.score || a.person.name.localeCompare(b.person.name, 'fr'))
        .slice(0, limit)
        .map(entry => entry.person);
}
