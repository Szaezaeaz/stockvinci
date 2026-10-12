import React, { useImperativeHandle, useState } from 'react';
import SearchBar from './SearchBar';
import { matchesQuery } from '../utils/search';
import { parseScan } from '../utils/scanParse';

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

    const linkedSerials = new Set(loans.map(loan => loan.pcSerial).filter(Boolean));
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
        if (loan.pcSerial) {
            texts.push(loan.pcSerial, devices?.[loan.pcSerial]?.modelName || '');
        }
    });
    person.orphans.forEach(device => texts.push(device.serial, device.model, device.modelName || ''));
    return texts;
}

// Onglet "Matériel attribué" : qui a quoi. Un scan (douchette) sur cet onglet
// filtre la liste sur le n° de série scanné.
export default function AssignedMaterial({ loans, devices, onReturnLoan, onReturnDevice, ref }) {
    const [query, setQuery] = useState('');

    useImperativeHandle(ref, () => ({
        handleScan(raw) {
            const { serial } = parseScan(raw);
            if (serial) setQuery(serial);
        }
    }));

    const everyone = groupByPerson(loans, devices);
    const visible = everyone.filter(person => matchesQuery(query, searchTexts(person, devices)));

    const assignedPcs = Object.values(devices || {}).filter(device => device.status === 'assigned').length;

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
            <h2>Matériel attribué</h2>
            <p className="assigned-summary">
                {everyone.length} personne{everyone.length > 1 ? 's' : ''} · {assignedPcs} PC attribué{assignedPcs > 1 ? 's' : ''}
            </p>

            <SearchBar value={query} onChange={setQuery} placeholder="Rechercher une personne, un n° de série, un matériel…" />

            {everyone.length === 0 && <div className="search-empty">Aucun matériel attribué pour le moment.</div>}
            {everyone.length > 0 && visible.length === 0 && <div className="search-empty">Aucun résultat.</div>}

            {visible.map(person => (
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
                                        {handedOver ? `Remis le ${dateOf(loan.pickedUpAt)}` : 'À récupérer'}
                                    </span>
                                    <button type="button" className="assignment-return" onClick={() => handleReturnLoan(person, loan)}>
                                        Matériel rendu
                                    </button>
                                </div>
                                <div className="assignment-items">
                                    {(loan.items || []).map((item, index) => {
                                        const isPc = loan.pcSerial && index === 0 && devices?.[loan.pcSerial]?.model === item;
                                        return (
                                            <span key={index} className={`assignment-chip${isPc ? ' assignment-chip-pc' : ''}`}>
                                                {item}
                                                {isPc && <small>S/N {loan.pcSerial}</small>}
                                            </span>
                                        );
                                    })}
                                </div>
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
        </div>
    );
}
