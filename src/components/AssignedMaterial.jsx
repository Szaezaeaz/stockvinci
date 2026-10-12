import React, { useMemo, useState } from 'react';
import { matchesQuery } from '../utils/search';
import { getLoanSerials } from '../utils/loans';
import LoanChips from './LoanChips';

// Avec tout le parc importé, il y a plus de mille personnes : on n'en affiche
// qu'une page à la fois (la recherche, elle, porte toujours sur tout le monde).
const PAGE_SIZE = 40;

const dateOf = (value) => (value ? new Date(value).toLocaleDateString() : '');
const nameKey = (name) => String(name || '').trim().toLowerCase();

// Regroupe par personne : ses fiches de matériel (à récupérer ou déjà remis) et
// les PC attribués dont la fiche n'existe plus (anciens "×").
function groupByPerson(loans, devices) {
    const people = new Map();
    const personOf = (rawName) => {
        const key = nameKey(rawName) || '-';
        if (!people.has(key)) people.set(key, { name: String(rawName || '').trim() || 'Sans nom', loans: [], orphans: [] });
        return people.get(key);
    };

    loans.forEach(loan => personOf(loan.name || loan.recipient).loans.push(loan));

    const linkedSerials = new Set(loans.flatMap(loan => getLoanSerials(loan)));
    Object.values(devices || {})
        .filter(device => device.status === 'assigned' && !linkedSerials.has(device.serial))
        .forEach(device => personOf(device.holder).orphans.push(device));

    return [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

// Texte retrouvable par la recherche pour une personne.
function searchTexts(person, devices) {
    const texts = [person.name];
    person.loans.forEach(loan => {
        texts.push(...(loan.items || []));
        getLoanSerials(loan).forEach(serial => texts.push(serial, devices?.[serial]?.modelName || ''));
    });
    person.orphans.forEach(device => texts.push(device.serial, device.model, device.modelName || ''));
    return texts;
}

// Volet "Remis" (ou "Tout") de l'onglet Attribué : qui a quoi, une carte par
// personne. scope 'given' = matériel déjà remis ; 'all' = aussi celui à remettre.
// La recherche (query) est celle de l'onglet.
export default function AssignedMaterial({ loans, devices, onReturnLoan, onReturnDevice, query = '', scope = 'given' }) {
    const [limit, setLimit] = useState(PAGE_SIZE);
    const everyone = useMemo(
        () => groupByPerson(scope === 'all' ? loans : loans.filter(loan => loan.pickedUpAt), devices),
        [loans, devices, scope]
    );
    const visible = useMemo(
        () => everyone.filter(person => matchesQuery(query, searchTexts(person, devices))),
        [everyone, query, devices]
    );
    const shown = visible.slice(0, limit);

    const handleReturnLoan = (person, loan) => {
        if (window.confirm(`${person.name} rend tout ce matériel ? Il retournera en stock.`)) {
            onReturnLoan(loan.id);
        }
    };

    const handleReturnDevice = (device) => {
        if (window.confirm(`Remettre ${device.serial} (${device.model}) en stock ?`)) {
            onReturnDevice(device.serial);
        }
    };

    return (
        <div className="assigned-section">
            {everyone.length === 0 && <div className="search-empty">Aucun matériel attribué pour le moment.</div>}
            {everyone.length > 0 && visible.length === 0 && <div className="search-empty">Aucun résultat.</div>}

            {visible.length > 0 && (
                <p className="list-count">
                    {visible.length} personne{visible.length > 1 ? 's' : ''}
                    {visible.length > shown.length ? ` · ${shown.length} affichées` : ''}
                </p>
            )}

            {shown.map(person => (
                <div key={nameKey(person.name)} className="person-card">
                    <div className="person-header">
                        <span className="person-name">{person.name}</span>
                        <span className="person-count">
                            {person.loans.length + person.orphans.length} attribution{person.loans.length + person.orphans.length > 1 ? 's' : ''}
                        </span>
                    </div>

                    {person.loans.map(loan => {
                        const handedOver = Boolean(loan.pickedUpAt);
                        return (
                            <div key={loan.id} className="assignment">
                                <div className="assignment-top">
                                    <span className={`assignment-badge ${handedOver ? 'assignment-badge-given' : 'assignment-badge-pending'}`}>
                                        {handedOver ? `Remis le ${dateOf(loan.pickedUpAt)}` : 'À remettre'}
                                    </span>
                                    <button type="button" className="assignment-return" onClick={() => handleReturnLoan(person, loan)}>
                                        Matériel rendu
                                    </button>
                                </div>
                                <LoanChips loan={loan} devices={devices} />
                            </div>
                        );
                    })}

                    {person.orphans.map(device => (
                        <div key={device.serial} className="assignment">
                            <div className="assignment-top">
                                <span className="assignment-badge assignment-badge-given">
                                    Attribué le {dateOf(device.events?.[0]?.date)}
                                </span>
                                <button type="button" className="assignment-return" onClick={() => handleReturnDevice(device)}>
                                    Remettre en stock
                                </button>
                            </div>
                            <div className="assignment-items">
                                <span className="assignment-chip assignment-chip-pc">
                                    {device.model}
                                    <small>S/N {device.serial}</small>
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ))}

            {visible.length > shown.length && (
                <button type="button" className="show-more" onClick={() => setLimit(limit + PAGE_SIZE)}>
                    Afficher plus ({visible.length - shown.length} restantes)
                </button>
            )}
        </div>
    );
}
