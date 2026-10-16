import React, { useMemo, useState } from 'react';
import { matchesQuery } from '../utils/search';
import { getLoanSerials } from '../utils/loans';
import { deviceFullName } from '../utils/models';
import { nameKey } from '../utils/person';
import { loanNote, noteMatches } from '../utils/notes';
import LoanChips from './LoanChips';
import NoteDialog from './NoteDialog';
import { ASSIGN_NOTE_PRESETS, DEVICE_NOTE_PRESETS } from '../config/notePresets';

// Avec tout le parc importé, il y a plus de mille personnes : on n'en affiche
// qu'une page à la fois (la recherche, elle, porte toujours sur tout le monde).
const PAGE_SIZE = 40;

const dateOf = (value) => (value ? new Date(value).toLocaleDateString() : '');

// Regroupe par personne : ses fiches de matériel (loans : celles à afficher) et
// les appareils attribués qui ne figurent dans aucune fiche (allLoans).
function groupByPerson(loans, allLoans, devices) {
    const people = new Map();
    const personOf = (rawName) => {
        const key = nameKey(rawName) || '-';
        if (!people.has(key)) people.set(key, { name: String(rawName || '').trim() || 'Sans nom', loans: [], orphans: [] });
        return people.get(key);
    };

    loans.forEach(loan => personOf(loan.name || loan.recipient).loans.push(loan));

    const linkedSerials = new Set(allLoans.flatMap(loan => getLoanSerials(loan)));
    Object.values(devices || {})
        .filter(device => device.status === 'assigned' && !linkedSerials.has(device.serial))
        .forEach(device => personOf(device.holder).orphans.push(device));

    return [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

// Texte retrouvable par la recherche pour une personne.
function searchTexts(person, devices) {
    const texts = [person.name];
    person.loans.forEach(loan => {
        texts.push(...(loan.items || []), loanNote(loan, devices));
        getLoanSerials(loan).forEach(serial => texts.push(serial, devices?.[serial]?.exactModel || '', devices?.[serial]?.modelName || ''));
    });
    person.orphans.forEach(device => texts.push(device.serial, device.model, device.exactModel || '', device.modelName || '', device.note || ''));
    return texts;
}

// Commentaires des attributions d'une personne.
const notesOf = (person, devices) => [
    ...person.loans.map(loan => loanNote(loan, devices)),
    ...person.orphans.map(device => device.note || '')
];

// Volet "Remis" (ou "Tout") de l'onglet Attribué : qui a quoi, une carte par
// personne. scope 'given' = matériel déjà remis ; 'all' = aussi celui à remettre.
// La recherche (query) et le filtre "commentaires" (noteFilter, voir utils/notes)
// sont ceux de l'onglet.
export default function AssignedMaterial({ loans, devices, onOpenReturn, onSetLoanNote, onSetDeviceNote, query = '', noteFilter = null, scope = 'given' }) {
    const [limit, setLimit] = useState(PAGE_SIZE);
    // Commentaire en cours de modification : { title, note, presets, save }.
    const [editing, setEditing] = useState(null);
    const everyone = useMemo(
        () => groupByPerson(scope === 'all' ? loans : loans.filter(loan => loan.pickedUpAt), loans, devices),
        [loans, devices, scope]
    );
    const visible = useMemo(
        () => everyone.filter(person =>
            matchesQuery(query, searchTexts(person, devices))
            && notesOf(person, devices).some(note => noteMatches(note, noteFilter))),
        [everyone, query, devices, noteFilter]
    );
    const shown = visible.slice(0, limit);

    // "Retour matériel" ouvre la fenêtre Retour, avec la personne et le matériel de cette attribution.
    const allEntriesOf = (person) => [
        ...person.loans.map(loan => ({
            key: `loan-${loan.id}`,
            handedOver: Boolean(loan.pickedUpAt),
            label: loan.pickedUpAt ? `Remis le ${dateOf(loan.pickedUpAt)}` : 'À remettre',
            onReturn: () => onOpenReturn({ name: person.name, serials: getLoanSerials(loan), items: loan.items || [] }),
            note: loanNote(loan, devices),
            onEditNote: () => setEditing({ title: `Commentaire · ${person.name}`, note: loanNote(loan, devices), presets: ASSIGN_NOTE_PRESETS, save: (text) => onSetLoanNote(loan.id, text) }),
            chips: <LoanChips loan={loan} devices={devices} />
        })),
        ...person.orphans.map(device => ({
            key: `device-${device.serial}`,
            handedOver: true,
            label: `Attribué le ${dateOf(device.events?.[0]?.date)}`,
            onReturn: () => onOpenReturn({ name: person.name, serials: [device.serial], items: [] }),
            note: device.note || '',
            onEditNote: () => setEditing({ title: `Commentaire · ${device.serial}`, note: device.note || '', presets: DEVICE_NOTE_PRESETS, save: (text) => onSetDeviceNote(device.serial, text) }),
            chips: (
                <div className="assignment-items">
                    <span className="assignment-chip assignment-chip-pc">
                        {deviceFullName(device)}
                        <small>S/N {device.serial}</small>
                    </span>
                </div>
            )
        }))
    ];

    // Avec le filtre "commentaires", seules les attributions concernées sont affichées.
    const entriesOf = (person) => allEntriesOf(person).filter(entry => noteMatches(entry.note, noteFilter));

    // Date (ou "À remettre") et bouton de retour d'une attribution.
    const actions = (entry) => (
        <>
            <span className={`assignment-badge ${entry.handedOver ? 'assignment-badge-given' : 'assignment-badge-pending'}`}>{entry.label}</span>
            <span className="assignment-buttons">
                {!entry.note && (
                    <button type="button" className="assignment-note-add" onClick={entry.onEditNote} aria-label="Ajouter un commentaire" title="Ajouter un commentaire">💬</button>
                )}
                <button type="button" className="assignment-return" onClick={entry.onReturn}>Retour matériel</button>
            </span>
        </>
    );

    // Commentaire d'une attribution, sous ses appareils ; un toucher le modifie.
    const noteLine = (entry) => entry.note && (
        <button type="button" className="loan-note" onClick={entry.onEditNote}>💬 {entry.note}</button>
    );

    return (
        <div className="assigned-section">
            {editing && (
                <NoteDialog
                    title={editing.title}
                    initial={editing.note}
                    presets={editing.presets}
                    allowClear
                    onConfirm={editing.save}
                    onClose={() => setEditing(null)}
                />
            )}
            {everyone.length === 0 && <div className="search-empty">Aucun matériel attribué pour le moment.</div>}
            {everyone.length > 0 && visible.length === 0 && <div className="search-empty">Aucun résultat.</div>}

            {visible.length > 0 && (
                <p className="list-count">
                    {visible.length} personne{visible.length > 1 ? 's' : ''}
                    {visible.length > shown.length ? ` · ${shown.length} affichées` : ''}
                </p>
            )}

            {shown.map(person => {
                const entries = entriesOf(person);
                // Une seule attribution : la date et le bouton passent sur la ligne du nom,
                // la carte reste basse. Plusieurs : une ligne par attribution.
                const single = entries.length === 1;
                return (
                    <div key={nameKey(person.name)} className="person-card">
                        <div className="person-header">
                            <span className="person-name">{person.name}</span>
                            {single ? (
                                <span className="person-header-actions">{actions(entries[0])}</span>
                            ) : (
                                <span className="person-count">{entries.length} attributions</span>
                            )}
                        </div>

                        {single ? <>{entries[0].chips}{noteLine(entries[0])}</> : entries.map(entry => (
                            <div key={entry.key} className="assignment">
                                <div className="assignment-top">{actions(entry)}</div>
                                {entry.chips}
                                {noteLine(entry)}
                            </div>
                        ))}
                    </div>
                );
            })}

            {visible.length > shown.length && (
                <button type="button" className="show-more" onClick={() => setLimit(limit + PAGE_SIZE)}>
                    Afficher plus ({visible.length - shown.length} restantes)
                </button>
            )}
        </div>
    );
}
