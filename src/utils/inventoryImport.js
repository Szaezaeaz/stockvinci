import { normalizeSerial } from './serial';
import { catalogEntry, kindOfModel } from './models';

// Import d'un inventaire (classeur lu par utils/xlsxRead) : on y cherche, dans
// chaque feuille, un tableau "modèle / numéro de série / personne", quel que soit
// l'ordre des colonnes.

const clean = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
const fold = (text) => clean(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Intitulés de colonne reconnus (sans accents ni majuscules).
const COLUMN_PATTERNS = [
    ['serial', /serie|serial|\bs\/?n\b|imei/],
    ['model', /modele|model|materiel|designation/],
    ['person', /user|utilisateur|collaborateur|\bnom\b|prenom|attribue|affecte|detenteur/]
];

// Valeurs de la colonne "personne" qui veulent dire : à personne (en stock).
const NOBODY = new Set(['', '-', 'non renseigne', 'non attribue', 'non affecte', 'inconnu', 'aucun', 'n/a', 'na', 'stock', 'en stock']);

// Si la ligne est une ligne d'intitulés, retourne { serial, model, person } (index
// des colonnes, person pouvant manquer) ; sinon null.
function headerColumns(row) {
    const columns = {};
    const taken = new Set();
    for (const [key, pattern] of COLUMN_PATTERNS) {
        const index = row.findIndex((cell, i) => !taken.has(i) && cell.length <= 40 && pattern.test(fold(cell)));
        if (index === -1) continue;
        columns[key] = index;
        taken.add(index);
    }
    return columns.serial !== undefined && columns.model !== undefined ? columns : null;
}

// Type d'appareil suggéré par le nom d'une feuille ("PC", "iPhone", "XCover-Android").
function kindOfSheet(name) {
    const text = fold(name);
    if (/iphone|android|xcover|telephone|mobile|smartphone/.test(text)) return 'phone';
    if (/\bpc\b|ordinateur|portable|laptop/.test(text)) return 'pc';
    return null;
}

// sheets : [{ name, rows }] ; devices : appareils déjà dans l'appli.
// Retourne :
//   rows        [{ serial, model, kind, person }] appareils à importer (person null = en stock)
//   conflicts   [{ serial, model, kind, people }] même n° de série pour plusieurs personnes : à trancher
//   alreadyKnown  nombre d'appareils du fichier déjà présents dans l'appli (ignorés)
//   noSerial      nombre de lignes sans n° de série (ignorées)
//   unknownModels [{ model, count }] modèles absents du catalogue de l'appli
//   found         false si aucun tableau d'inventaire n'a été reconnu
export function analyzeInventory(sheets, devices = {}) {
    const bySerial = new Map();
    let found = false;
    let noSerial = 0;

    for (const sheet of sheets) {
        const sheetKind = kindOfSheet(sheet.name);
        let columns = null;
        for (const rawRow of sheet.rows) {
            const row = rawRow.map(clean);
            const header = headerColumns(row);
            if (header) {
                columns = header;
                found = true;
                continue;
            }
            if (!columns) continue;

            const serial = normalizeSerial(row[columns.serial]);
            const model = row[columns.model] || '';
            const rawPerson = columns.person === undefined ? '' : row[columns.person] || '';
            const person = NOBODY.has(fold(rawPerson)) ? null : rawPerson;
            if (!serial || !model) {
                if (model && person) noSerial++;
                continue;
            }

            // Une même ligne peut figurer dans plusieurs feuilles (récapitulatif +
            // feuille par catégorie) : on ne garde qu'un appareil par n° de série.
            if (!bySerial.has(serial)) bySerial.set(serial, { serial, model, sheetKind, people: [] });
            const entry = bySerial.get(serial);
            entry.sheetKind = entry.sheetKind || sheetKind;
            if (person && !entry.people.some(other => fold(other) === fold(person))) entry.people.push(person);
        }
    }

    const rows = [];
    const conflicts = [];
    const unknown = new Map();
    let alreadyKnown = 0;
    for (const { serial, model, sheetKind, people } of bySerial.values()) {
        if (devices[serial]) {
            alreadyKnown++;
            continue;
        }
        const kind = catalogEntry(model)?.kind || sheetKind || kindOfModel(model);
        if (!catalogEntry(model)) unknown.set(model, (unknown.get(model) || 0) + 1);
        if (people.length > 1) conflicts.push({ serial, model, kind, people });
        else rows.push({ serial, model, kind, person: people[0] || null });
    }

    return {
        found,
        rows,
        conflicts,
        alreadyKnown,
        noSerial,
        unknownModels: [...unknown].map(([model, count]) => ({ model, count }))
    };
}

// Appareils à importer une fois les doublons tranchés.
// choices : { [serial]: nom de la personne retenue, ou '' pour "en stock" }.
export function resolveImport(analysis, choices) {
    return [
        ...analysis.rows,
        ...analysis.conflicts
            .filter(conflict => choices[conflict.serial] !== undefined)
            .map(({ serial, model, kind }) => ({ serial, model, kind, person: choices[serial] || null }))
    ];
}

// Chiffres affichés avant de valider l'import.
export function summarizeImport(rows) {
    const people = new Set(rows.filter(row => row.person).map(row => fold(row.person)));
    return {
        total: rows.length,
        pcs: rows.filter(row => row.kind === 'pc').length,
        phones: rows.filter(row => row.kind === 'phone').length,
        people: people.size,
        inStock: rows.filter(row => !row.person).length
    };
}
