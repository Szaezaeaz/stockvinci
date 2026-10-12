import React, { useState } from 'react';
import Modal from './Modal';
import { readWorkbook } from '../utils/xlsxRead';
import { analyzeInventory, resolveImport, summarizeImport } from '../utils/inventoryImport';
import { shortModelName } from '../utils/models';

const count = (number) => number.toLocaleString('fr-FR');
const plural = (number, word) => `${count(number)} ${word}${number > 1 ? 's' : ''}`;

// Import d'un inventaire existant depuis un classeur Excel : choix du fichier,
// aperçu de ce qui va être créé (avec les doublons à trancher), puis validation.
// Le fichier est lu sur l'appareil ; rien n'est modifié avant la validation.
export default function ImportModal({ isOpen, onClose, devices, onImport }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [fileName, setFileName] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [choices, setChoices] = useState({}); // doublons tranchés : n° de série -> personne ('' = en stock)
    const [done, setDone] = useState(null); // chiffres de l'import une fois validé

    const reset = () => {
        setError('');
        setFileName('');
        setAnalysis(null);
        setChoices({});
        setDone(null);
    };

    const close = () => {
        reset();
        onClose();
    };

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // permet de rechoisir le même fichier
        if (!file) return;
        reset();
        setBusy(true);
        try {
            const result = analyzeInventory(await readWorkbook(await file.arrayBuffer()), devices);
            if (result.found) {
                setAnalysis(result);
                setFileName(file.name);
            } else {
                setError("Aucun tableau d'inventaire trouvé dans ce fichier. Il faut une ligne d'intitulés avec au moins « Modèle » et « Numéro de série » (et « Nom » pour les attributions).");
            }
        } catch {
            setError("Ce fichier n'a pas pu être lu. L'import attend un classeur Excel (.xlsx).");
        } finally {
            setBusy(false);
        }
    };

    const rows = analysis ? resolveImport(analysis, choices) : [];
    const summary = summarizeImport(rows);
    const undecided = analysis ? analysis.conflicts.filter(conflict => choices[conflict.serial] === undefined).length : 0;

    const handleImport = () => {
        if (undecided > 0 || rows.length === 0) return;
        onImport(rows);
        setDone(summary);
    };

    return (
        <Modal isOpen={isOpen} onClose={close} title="Importer un inventaire">
            {done ? (
                <div className="import-done">
                    <p className="import-done-title">Import terminé</p>
                    <p>
                        {plural(done.total, 'appareil')} ajouté{done.total > 1 ? 's' : ''} : {count(done.total - done.inStock)} attribué{done.total - done.inStock > 1 ? 's' : ''} à {plural(done.people, 'personne')}, {count(done.inStock)} en stock.
                    </p>
                    <p className="scan-hint">
                        Tu les retrouves dans l'onglet Attribué (recherche par nom, modèle ou n° de série). En cas d'erreur,
                        le bouton Rollback annule tout l'import.
                    </p>
                    <button type="button" className="btn-add full-width-btn" onClick={close}>Fermer</button>
                </div>
            ) : (
                <>
                    <p className="import-intro">
                        Choisis le classeur Excel de l'inventaire : une ligne par appareil, avec son modèle, son n° de série
                        et le nom de la personne qui l'utilise. Rien n'est modifié avant la validation.
                    </p>

                    <label className={`import-file${busy ? ' import-file-busy' : ''}`}>
                        <input type="file" accept=".xlsx" onChange={handleFile} disabled={busy} hidden />
                        {busy ? 'Lecture du fichier…' : fileName ? `📄 ${fileName} — changer de fichier` : 'Choisir le fichier Excel (.xlsx)'}
                    </label>

                    {error && <p className="scan-feedback scan-error">{error}</p>}

                    {analysis && (
                        <>
                            <ul className="import-summary">
                                <li><strong>{plural(summary.total, 'appareil')}</strong> à importer : {count(summary.pcs)} PC, {plural(summary.phones, 'téléphone')}</li>
                                <li><strong>{count(summary.total - summary.inStock)}</strong> attribué{summary.total - summary.inStock > 1 ? 's' : ''} à <strong>{plural(summary.people, 'personne')}</strong></li>
                                <li><strong>{count(summary.inStock)}</strong> en stock (sans utilisateur dans le fichier)</li>
                                <li>Les PC sont classés en Occasion.</li>
                                {analysis.alreadyKnown > 0 && (
                                    <li className="import-note">{plural(analysis.alreadyKnown, 'appareil')} du fichier déjà dans l'appli : ignoré{analysis.alreadyKnown > 1 ? 's' : ''}.</li>
                                )}
                                {analysis.noSerial > 0 && (
                                    <li className="import-note">{plural(analysis.noSerial, 'ligne')} sans n° de série : ignorée{analysis.noSerial > 1 ? 's' : ''}.</li>
                                )}
                                {analysis.unknownModels.length > 0 && (
                                    <li className="import-note">
                                        Modèles absents du catalogue de l'appli (importés tels quels) :{' '}
                                        {analysis.unknownModels.map(({ model, count: number }) => `${model} (${number})`).join(', ')}
                                    </li>
                                )}
                            </ul>

                            {analysis.conflicts.length > 0 && (
                                <div className="import-conflicts">
                                    <p className="import-conflicts-title">
                                        {plural(analysis.conflicts.length, 'appareil')} en double dans le fichier, pour des personnes différentes. À qui l'attribuer ?
                                    </p>
                                    {analysis.conflicts.map(conflict => (
                                        <div key={conflict.serial} className="import-conflict">
                                            <div className="import-conflict-device">
                                                <span className="device-serial">{conflict.serial}</span>
                                                <span className="device-sub">{shortModelName(conflict.model)}</span>
                                            </div>
                                            <div className="pill-row">
                                                {[...conflict.people, ''].map(person => (
                                                    <button
                                                        key={person || '-'}
                                                        type="button"
                                                        className={`pill-toggle${choices[conflict.serial] === person ? ' active' : ''}`}
                                                        onClick={() => setChoices(prev => ({ ...prev, [conflict.serial]: person }))}
                                                    >
                                                        {person || 'Personne (en stock)'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                type="button"
                                className="btn-add full-width-btn"
                                style={{ marginTop: '16px', background: undecided === 0 && rows.length > 0 ? '#22c55e' : '#cbd5e1' }}
                                disabled={undecided > 0 || rows.length === 0}
                                onClick={handleImport}
                            >
                                {undecided > 0
                                    ? `Choisis pour ${plural(undecided, 'doublon')}`
                                    : rows.length === 0
                                        ? 'Rien à importer'
                                        : `Importer ${plural(rows.length, 'appareil')}`}
                            </button>
                        </>
                    )}
                </>
            )}
        </Modal>
    );
}
