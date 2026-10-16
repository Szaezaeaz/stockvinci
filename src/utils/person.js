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

// Personnes connues, pour proposer leur nom pendant la saisie. L'historique ajoute
// celles qui n'ont reçu que des accessoires (dons).
export function listPeople(loans = [], devices = {}, history = []) {
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
    history.forEach(entry => {
        if (entry.recipient && entry.recipient !== 'Anonyme') add(entry.recipient);
    });
    return [...people.values()];
}

export const isKnownPerson = (people, name) => {
    const key = nameKey(name);
    return people.some(person => nameKey(person.name) === key);
};

// Nombre de lettres à changer pour passer d'un mot à l'autre (distance de Levenshtein).
function editDistance(a, b) {
    let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        previous = current;
    }
    return previous[b.length];
}

// Personnes connues dont le nom ressemble à celui saisi (faute de frappe, prénom
// abrégé, NOM et prénom inversés) : proposées avant de créer une nouvelle personne.
export function similarPeople(people, name, limit = 3) {
    const { last, first } = splitName(name);
    const key = nameKey(name);
    const lastKey = nameKey(last);
    const firstKey = nameKey(first);
    const swapped = nameKey(`${first} ${last}`);
    const scored = [];
    for (const person of people) {
        const personKey = nameKey(person.name);
        const distance = Math.min(editDistance(key, personKey), editDistance(swapped, personKey));
        const tolerance = Math.max(2, Math.floor(key.length / 6));
        const sameLast = lastKey && person.lastKey === lastKey
            && (!firstKey || !person.firstKey || person.firstKey[0] === firstKey[0]);
        const lastTypo = lastKey.length >= 4 && editDistance(lastKey, person.lastKey) <= 1 && (!firstKey || person.firstKey === firstKey);
        if (distance <= tolerance || sameLast || lastTypo) scored.push({ person, distance });
    }
    return scored
        .sort((a, b) => a.distance - b.distance || a.person.name.localeCompare(b.person.name, 'fr'))
        .slice(0, limit)
        .map(entry => entry.person);
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
