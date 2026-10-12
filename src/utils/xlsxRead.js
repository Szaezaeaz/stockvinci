// Lecture d'un classeur Excel (.xlsx) dans le navigateur, sans bibliothèque : un
// .xlsx est une archive zip de fichiers XML. On n'en lit que le texte des
// cellules, ce qui suffit pour importer un inventaire.
// readWorkbook(arrayBuffer) -> [{ name, rows }] ; rows : tableau de lignes, chaque
// ligne étant un tableau de textes ('' pour une cellule vide).

const decoder = new TextDecoder('utf-8');

// --- Archive zip --------------------------------------------------------------

async function inflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Table des fichiers de l'archive : nom -> fonction qui en retourne le texte.
function listEntries(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    // Le répertoire central est annoncé par un bloc placé tout à la fin du fichier.
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
        if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end === -1) throw new Error('not_a_zip');

    const count = view.getUint16(end + 10, true);
    let offset = view.getUint32(end + 16, true);
    const entries = new Map();
    for (let n = 0; n < count; n++) {
        if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('bad_zip');
        const method = view.getUint16(offset + 10, true);
        const size = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const local = view.getUint32(offset + 42, true);
        const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

        entries.set(name, async () => {
            const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
            const data = bytes.subarray(start, start + size);
            if (method === 0) return decoder.decode(data);
            if (method === 8) return decoder.decode(await inflate(data));
            throw new Error('bad_zip');
        });
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

// --- XML ------------------------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(text) {
    return text
        .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, code) => {
            if (code[0] !== '#') return ENTITIES[code] ?? match;
            const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
            return String.fromCodePoint(point);
        })
        // Excel écrit certains caractères de contrôle sous la forme _x000D_
        .replace(/_x([0-9A-F]{4})_/g, (match, hex) => (parseInt(hex, 16) < 32 ? ' ' : match));
}

const attribute = (tag, name) => tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];

// Texte d'un élément <si> ou <is> : la concaténation de ses <t>, hors annotations
// phonétiques (<rPh>).
function richText(xml) {
    const parts = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g);
    return decodeXml([...parts].map(part => part[1] || '').join(''));
}

// "C12" -> 2 (index de colonne, à partir de 0).
function columnIndex(reference) {
    let index = 0;
    for (const letter of reference.match(/^[A-Z]+/)?.[0] || '') index = index * 26 + (letter.charCodeAt(0) - 64);
    return index - 1;
}

// Nombre tel qu'Excel l'enregistre ("3.5E+14") -> écriture ordinaire.
function plainNumber(text) {
    if (!/e/i.test(text)) return text;
    const number = Number(text);
    return Number.isInteger(number) ? BigInt(number).toString() : text;
}

function parseSheet(xml, sharedStrings) {
    const rows = [];
    for (const rowMatch of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
        const rowNumber = Number(attribute(rowMatch[1], 'r')) || rows.length + 1;
        const row = [];
        let next = 0;
        for (const cell of (rowMatch[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const reference = attribute(cell[1], 'r');
            const column = reference ? columnIndex(reference) : next;
            next = column + 1;
            const type = attribute(cell[1], 't');
            const body = cell[2] || '';
            const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? '';
            let value;
            if (type === 's') value = sharedStrings[Number(raw)] ?? '';
            else if (type === 'inlineStr') value = richText(body);
            else if (type === 'str' || type === 'e') value = decodeXml(raw);
            else if (type === 'b') value = raw === '1' ? 'VRAI' : 'FAUX';
            else value = plainNumber(raw);
            row[column] = value;
        }
        while (rows.length < rowNumber - 1) rows.push([]);
        rows[rowNumber - 1] = Array.from(row, value => value ?? '');
    }
    return rows;
}

// Chemin d'une cible de relation ("worksheets/sheet1.xml", "/xl/worksheets/...") dans l'archive.
const resolveTarget = (target) => (target.startsWith('/') ? target.slice(1) : `xl/${target}`);

export async function readWorkbook(buffer) {
    const entries = listEntries(buffer);
    // Certains logiciels préfixent les balises ("<x:row>") : on retire le préfixe
    // pour lire tous les classeurs de la même façon.
    const read = async (name) => {
        if (!entries.has(name)) return null;
        return (await entries.get(name)()).replace(/<(\/?)[A-Za-z_][\w.-]*:/g, '<$1');
    };

    const workbook = await read('xl/workbook.xml');
    const relations = await read('xl/_rels/workbook.xml.rels');
    if (!workbook || !relations) throw new Error('not_a_workbook');

    const targets = new Map();
    let sharedPath = 'xl/sharedStrings.xml';
    for (const [tag] of relations.matchAll(/<Relationship\b[^>]*>/g)) {
        const target = resolveTarget(attribute(tag, 'Target') || '');
        targets.set(attribute(tag, 'Id'), target);
        if (/sharedStrings$/.test(attribute(tag, 'Type') || '')) sharedPath = target;
    }

    const sharedXml = await read(sharedPath);
    const sharedStrings = sharedXml
        ? [...sharedXml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map(match => richText(match[1] || ''))
        : [];

    const sheets = [];
    for (const [tag] of workbook.matchAll(/<sheet\b[^>]*>/g)) {
        const xml = await read(targets.get(attribute(tag, 'r:id')) || '');
        if (xml) sheets.push({ name: decodeXml(attribute(tag, 'name') || ''), rows: parseSheet(xml, sharedStrings) });
    }
    return sheets;
}
