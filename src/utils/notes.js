import { getLoanSerials } from './loans';

// Commentaire d'une attribution : le sien, sinon celui d'un de ses appareils (ajouté
// depuis la fiche de l'appareil).
export function loanNote(loan, devices) {
    if (loan.note) return loan.note;
    for (const serial of getLoanSerials(loan)) {
        if (devices?.[serial]?.note) return devices[serial].note;
    }
    return '';
}

const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();

// Filtre "commentaires" : null = pas de filtre, '' = tout ce qui a un commentaire,
// sinon ce commentaire précis.
export function noteMatches(note, filter) {
    if (filter === null || filter === undefined) return true;
    if (!note) return false;
    return filter === '' || normalize(note) === normalize(filter);
}

// Appareils attribués qui ne figurent dans aucune attribution (parc importé).
export function orphanDevices(loans, devices) {
    const linked = new Set(loans.flatMap(loan => getLoanSerials(loan)));
    return Object.values(devices || {}).filter(device => device.status === 'assigned' && !linked.has(device.serial));
}

// Commentaires utilisés, du plus fréquent au moins fréquent : [{ note, count }].
export function usedNotes(notes) {
    const counts = new Map();
    notes.filter(Boolean).forEach(note => {
        const key = normalize(note);
        const entry = counts.get(key) || { note, count: 0 };
        entry.count++;
        counts.set(key, entry);
    });
    return [...counts.values()].sort((a, b) => b.count - a.count || a.note.localeCompare(b.note, 'fr'));
}
