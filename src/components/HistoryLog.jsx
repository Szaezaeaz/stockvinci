import React, { useState } from 'react';
import SearchBar from './SearchBar';
import DeviceListModal from './DeviceListModal';
import { matchesQuery } from '../utils/search';

// Types de mouvement : filtres en haut de la liste et icône de chaque ligne.
const HISTORY_TYPES = [
    { key: 'attribution', label: 'Attributions', icon: '👤', match: (category) => category === 'Attribution' },
    { key: 'remise', label: 'Remises', icon: '🤝', match: (category) => category === 'Remise' },
    { key: 'retour', label: 'Retours', icon: '↩', match: (category) => category === 'Retour matériels' },
    { key: 'reception', label: 'Réceptions', icon: '↓', match: (category) => category === 'Réception stock' || category === 'Import inventaire' },
    { key: 'sortie', label: 'Sorties', icon: '↑', match: (category) => category.startsWith('Sortie accessoires') },
    { key: 'autre', label: 'Autres', icon: '⚙', match: () => true }
];
const typeOf = (category) => HISTORY_TYPES.find(type => type.match(String(category || '')));

// Date au format des champs date (AAAA-MM-JJ), à l'heure locale, et l'inverse.
const localDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDay = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
};

// Texte retrouvable par la recherche : type, personne, matériel et n° de série, commentaire.
const searchTexts = (item) => [item.category, item.recipient || '', ...(Array.isArray(item.details) ? item.details : []), item.note || ''];

// Réunit les mouvements identiques faits à moins de 3 minutes d'écart (même type, même
// sens, même personne, même commentaire). Les plus récents d'abord.
function aggregateHistory(items) {
    const sorted = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
    const aggregated = [];
    for (const item of sorted) {
        const last = aggregated[aggregated.length - 1];
        const mergeable = last
            && last.category === item.category
            && (last.recipient || '') === (item.recipient || '')
            && (last.note || '') === (item.note || '')
            && ((last.delta > 0 && item.delta > 0) || (last.delta < 0 && item.delta < 0))
            && Math.abs(new Date(last.date) - new Date(item.date)) <= 3 * 60 * 1000;
        if (mergeable) {
            last.delta += item.delta;
            last.count += 1;
        } else {
            aggregated.push({ ...item, count: 1 });
        }
    }
    return aggregated;
}

export default function HistoryLog({ history, devices, stock, onRemoveUntracked, onDeleteDevice, onSetDeviceNote }) {
    // Mois dépliés à la main ; par défaut, seul le plus récent l'est.
    const [expandedMonths, setExpandedMonths] = useState({});
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState(null); // clé de HISTORY_TYPES, ou null = tous
    const [openDevice, setOpenDevice] = useState(null); // { model, serial } : fiche ouverte
    const searching = query.trim() !== '';

    // Par défaut : du 1er du mois à aujourd'hui.
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        return localDay(new Date(now.getFullYear(), now.getMonth(), 1));
    });
    const [endDate, setEndDate] = useState(() => localDay(new Date()));

    // Une recherche porte sur tout l'historique, sans les dates.
    const inPeriod = history.filter(item => {
        if (searching) return matchesQuery(query, searchTexts(item));
        const day = new Date(item.date).setHours(0, 0, 0, 0);
        if (startDate && day < parseDay(startDate).getTime()) return false;
        if (endDate && day > parseDay(endDate).getTime()) return false;
        return true;
    });
    const countOf = (key) => inPeriod.filter(item => typeOf(item.category).key === key).length;
    const filteredHistory = typeFilter ? inPeriod.filter(item => typeOf(item.category).key === typeFilter) : inPeriod;

    const downloadCSV = () => {
        if (filteredHistory.length === 0) {
            alert('Aucune donnée à exporter pour cette période.');
            return;
        }
        const quote = (text) => `"${String(text).replace(/"/g, '""')}"`;
        const headers = ['Date', 'Heure', 'Type', 'Mouvement', 'Bénéficiaire', 'Quantité', 'Détails', 'Commentaire'];
        const rows = filteredHistory.map(item => {
            const date = new Date(item.date);
            return [
                date.toLocaleDateString(),
                date.toLocaleTimeString(),
                quote(item.category),
                item.delta > 0 ? 'Entrée' : item.delta < 0 ? 'Sortie' : 'Remise',
                quote(item.recipient || 'N/A'),
                item.delta,
                quote(Array.isArray(item.details) ? item.details.join(', ') : ''),
                quote(item.note || '')
            ].join(';'); // point-virgule : Excel en français
        });
        // BOM : Excel lit l'UTF-8 (accents).
        const blob = new Blob(['﻿' + [headers.join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', searching ? 'rapport_stock_it_recherche.csv' : `rapport_stock_it_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (history.length === 0) {
        return (
            <div className="history-section">
                <h2>Historique</h2>
                <p style={{ color: '#999', textAlign: 'center' }}>Aucun mouvement.</p>
            </div>
        );
    }

    // Mois ("octobre 2026") -> jour ("16/10/2026") -> mouvements.
    const groupedByMonth = filteredHistory.reduce((months, item) => {
        const date = new Date(item.date);
        const monthKey = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const dayKey = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        months[monthKey] = months[monthKey] || {};
        months[monthKey][dayKey] = months[monthKey][dayKey] || [];
        months[monthKey][dayKey].push(item);
        return months;
    }, {});
    const sortedMonths = Object.keys(groupedByMonth); // l'historique est déjà du plus récent au plus ancien

    const isExpanded = (monthKey, index) => searching || (expandedMonths[monthKey] ?? index === 0);
    const toggleMonth = (monthKey, index) => setExpandedMonths(prev => ({ ...prev, [monthKey]: !isExpanded(monthKey, index) }));

    // "G11 Neuf (S/N 5CG1111AAA)" : le n° de série ouvre la fiche de l'appareil.
    const renderDetail = (detail) => {
        const match = /^(.*\(S\/N )([^)]+)(\).*)$/.exec(detail);
        const device = match && devices?.[match[2]];
        if (!device) return detail;
        return (
            <>
                {match[1]}
                <button type="button" className="history-serial" onClick={() => setOpenDevice({ model: device.model, serial: device.serial })}>
                    {match[2]}
                </button>
                {match[3]}
            </>
        );
    };

    return (
        <div className="history-section">
            {openDevice && (
                <DeviceListModal
                    model={openDevice.model}
                    initialSerial={openDevice.serial}
                    devices={devices}
                    stock={stock}
                    onClose={() => setOpenDevice(null)}
                    onRemoveUntracked={onRemoveUntracked}
                    onDeleteDevice={onDeleteDevice}
                    onSetDeviceNote={onSetDeviceNote}
                />
            )}

            <div className="history-header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                <h2>Historique</h2>

                <div className="csv-controls">
                    <input type="date" className="mini-date-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} title="Date de début" />
                    <span className="date-separator">au</span>
                    <input type="date" className="mini-date-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} title="Date de fin" />
                    <button className="btn-download-csv" onClick={downloadCSV} title="Télécharger en CSV">📥 CSV</button>
                </div>
            </div>

            <SearchBar value={query} onChange={setQuery} placeholder="Rechercher un nom, un n° de série, un matériel…" />

            <div className="history-filters">
                <button type="button" className={`history-filter${typeFilter === null ? ' active' : ''}`} onClick={() => setTypeFilter(null)}>
                    Tous<small>{inPeriod.length}</small>
                </button>
                {HISTORY_TYPES.map(type => {
                    const count = countOf(type.key);
                    if (count === 0 && typeFilter !== type.key) return null;
                    return (
                        <button
                            key={type.key}
                            type="button"
                            className={`history-filter${typeFilter === type.key ? ' active' : ''}`}
                            onClick={() => setTypeFilter(typeFilter === type.key ? null : type.key)}
                        >
                            {type.icon} {type.label}<small>{count}</small>
                        </button>
                    );
                })}
            </div>

            {searching && (
                <p className="list-count">
                    {filteredHistory.length} mouvement{filteredHistory.length > 1 ? 's' : ''} trouvé{filteredHistory.length > 1 ? 's' : ''} sur tout l’historique
                </p>
            )}

            <div className="history-container">
                {filteredHistory.length === 0 && (
                    <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>{searching ? 'Aucun mouvement trouvé.' : 'Aucun mouvement sur cette période.'}</p>
                )}

                {sortedMonths.map((monthKey, monthIndex) => {
                    const expanded = isExpanded(monthKey, monthIndex);
                    const days = groupedByMonth[monthKey];
                    return (
                        <div key={monthKey} className="history-month-group">
                            <div className={`history-month-header ${expanded ? 'expanded' : ''}`} onClick={() => toggleMonth(monthKey, monthIndex)}>
                                <span className="month-label">{monthKey}</span>
                                <span className="month-icon">{expanded ? '▼' : '▶'}</span>
                            </div>

                            {expanded && (
                                <div className="history-month-content fade-in">
                                    {Object.keys(days).map(dayKey => (
                                        <div key={dayKey} className="history-day-group">
                                            <div className="history-date-header">{dayKey}</div>
                                            <ul className="history-list-compact">
                                                {aggregateHistory(days[dayKey]).map(item => {
                                                    const isIn = item.delta > 0;
                                                    const isNeutral = item.delta === 0; // remise : pas de mouvement de stock
                                                    const time = new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                    return (
                                                        <li key={item.id} className={`history-item-compact ${isNeutral ? 'neutral' : isIn ? 'in' : 'out'}`} style={{ alignItems: 'flex-start' }}>
                                                            <span className="history-time-compact">{time}</span>
                                                            <div className="history-category-compact" style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <div style={{ fontWeight: 500 }}>
                                                                    <span className="history-type-icon" aria-hidden="true">{typeOf(item.category).icon}</span>
                                                                    {item.category}
                                                                    {item.count > 1 && <span style={{ fontSize: '0.8em', opacity: 0.7, marginLeft: '6px' }}>({item.count} mouvements)</span>}
                                                                </div>

                                                                {item.recipient && item.recipient !== 'Anonyme' && (
                                                                    <div style={{ fontSize: '0.85em', color: '#64748b', marginTop: '2px' }}>
                                                                        👤 {item.recipient}
                                                                    </div>
                                                                )}

                                                                {Array.isArray(item.details) && item.details.length > 0 && (
                                                                    <div style={{ fontSize: '0.8em', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>
                                                                        {item.details.map((detail, index) => (
                                                                            <React.Fragment key={index}>
                                                                                {index > 0 && ', '}
                                                                                {renderDetail(detail)}
                                                                            </React.Fragment>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {item.note && <div className="history-note">💬 {item.note}</div>}
                                                            </div>
                                                            <span className="history-delta-compact">
                                                                {isNeutral ? '✓' : `${isIn ? '+' : ''}${item.delta}`}
                                                            </span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
