import React, { useImperativeHandle, useRef, useState } from 'react';
import AssignedMaterial from './AssignedMaterial';
import ImportModal from './ImportModal';
import LoanedPCs from './LoanedPCs';
import SearchBar from './SearchBar';
import { parseScan } from '../utils/scanParse';

const PANES = ['given', 'pending', 'all'];

// Onglet "Attribution" : tout ce qui est rattaché à une personne.
//  - Remis : qui a quoi dans l'entreprise (une carte par personne).
//  - À remettre : matériel préparé, encore en stock, avec le bouton "Remis".
//  - Tout : les deux ensemble.
// Le bouton "Attribuer du matériel" ouvre le formulaire d'attribution ; "Importer"
// reprend un inventaire existant depuis un classeur Excel.
export default function AssignedTab({ loans, devices, stock, onAdd, onHandOver, onSetLoanNote, onSetDeviceNote, onOpenReturn, onReceiveDevices, onImport, ref }) {
    const [pane, setPane] = useState('given');
    const [importOpen, setImportOpen] = useState(false);
    const [query, setQuery] = useState('');
    const formRef = useRef(null);

    // Scan hors champ : sur "À remettre", on ouvre le formulaire avec le PC choisi ;
    // ailleurs, la liste est filtrée sur le n° de série scanné.
    useImperativeHandle(ref, () => ({
        handleScan(raw) {
            if (pane === 'pending') {
                formRef.current?.handleScan(raw);
            } else {
                const { serial } = parseScan(raw);
                if (serial) setQuery(serial);
            }
        }
    }));

    const givenCount = loans.filter(loan => loan.pickedUpAt).length;
    const pendingCount = loans.length - givenCount;
    const labels = { given: `Remis (${givenCount})`, pending: `À remettre (${pendingCount})`, all: 'Tout' };

    return (
        <div className="assigned-tab">
            <div className="loan-header-actions">
                <h2>Attribution</h2>
                <div className="assigned-header-buttons">
                    <button type="button" className="btn-import-trigger" onClick={() => setImportOpen(true)}>
                        Importer
                    </button>
                    <button type="button" className="btn-add-trigger" onClick={() => formRef.current?.openForm()}>
                        + Attribuer du matériel
                    </button>
                </div>
            </div>

            <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} devices={devices} onImport={onImport} />

            <div className="segmented-control assigned-panes">
                {PANES.map(key => (
                    <button
                        key={key}
                        type="button"
                        className={`segment-btn ${pane === key ? 'active' : ''}`}
                        onClick={() => setPane(key)}
                    >
                        {labels[key]}
                    </button>
                ))}
            </div>

            <SearchBar value={query} onChange={setQuery} placeholder="Rechercher une personne, un n° de série, un matériel…" />

            <LoanedPCs
                ref={formRef}
                loans={loans}
                devices={devices}
                stock={stock}
                onAdd={onAdd}
                onHandOver={onHandOver}
                onSetLoanNote={onSetLoanNote}
                onReceiveDevices={onReceiveDevices}
                query={query}
                showList={pane === 'pending'}
            />

            {pane !== 'pending' && (
                <AssignedMaterial
                    key={`${pane}:${query}`} // repart de la première page à chaque recherche
                    loans={loans}
                    devices={devices}
                    onOpenReturn={onOpenReturn}
                    onSetLoanNote={onSetLoanNote}
                    onSetDeviceNote={onSetDeviceNote}
                    query={query}
                    scope={pane === 'all' ? 'all' : 'given'}
                />
            )}
        </div>
    );
}
