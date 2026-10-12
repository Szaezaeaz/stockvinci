import React, { useState } from 'react';
import Modal from './Modal';
import SearchBar from './SearchBar';
import { matchesQuery } from '../utils/search';
import { catalogEntry, groupOfModel, kindOfModel, listModels, shortModelName } from '../utils/models';

const GROUP_ORDER = ['PC', 'iPhone', 'Android'];

// Choix d'un modèle précis parmi tous ceux du parc : un bouton qui ouvre la liste
// complète, avec une recherche (le parc compte plusieurs dizaines de modèles).
// value : nom exact du modèle, ou '' si aucun.
// kind : 'pc' ou 'phone' pour ne proposer qu'un type d'appareil.
// suggestions : modèles à proposer en premier (ex. ceux qu'un QR code peut désigner).
// compact : petit bouton, pour une ligne de liste.
export default function ModelPicker({ value, onChange, devices, kind, suggestions = [], placeholder = 'Choisir le modèle', compact = false }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const close = () => {
        setOpen(false);
        setQuery('');
    };
    const pick = (name) => {
        onChange(name);
        close();
    };

    const models = open
        ? listModels(devices)
            .filter(name => !kind || kindOfModel(name) === kind)
            .filter(name => matchesQuery(query, [name, catalogEntry(name)?.line || '']))
        : [];
    const suggested = suggestions.filter(name => models.includes(name));
    const groups = GROUP_ORDER
        .map(group => ({ group, names: models.filter(name => groupOfModel(name) === group && !suggested.includes(name)) }))
        .filter(({ names }) => names.length > 0);

    const option = (name) => (
        <li key={name}>
            <button type="button" className={`model-option${name === value ? ' model-option-current' : ''}`} onClick={() => pick(name)}>
                <span className="model-option-name">{shortModelName(name)}</span>
                {catalogEntry(name)?.line && <span className="model-option-line">Stock : {catalogEntry(name).line}</span>}
            </button>
        </li>
    );

    return (
        <>
            <button
                type="button"
                className={`model-picker-button${compact ? ' model-picker-compact' : ''}${value ? '' : ' model-picker-empty'}`}
                onClick={(e) => { e.currentTarget.blur(); setOpen(true); }}
            >
                <span>{value ? shortModelName(value) : placeholder}</span>
                <span className="model-picker-caret">▾</span>
            </button>

            <Modal isOpen={open} onClose={close} title="Choisir le modèle">
                <SearchBar value={query} onChange={setQuery} placeholder="Rechercher un modèle (ex. 640 G11, A36)…" />
                {models.length === 0 && <div className="search-empty">Aucun modèle trouvé.</div>}
                {suggested.length > 0 && (
                    <>
                        <div className="model-group-title">Modèles possibles</div>
                        <ul className="model-options">{suggested.map(option)}</ul>
                    </>
                )}
                {groups.map(({ group, names }) => (
                    <React.Fragment key={group}>
                        <div className="model-group-title">{group}</div>
                        <ul className="model-options">{names.map(option)}</ul>
                    </React.Fragment>
                ))}
            </Modal>
        </>
    );
}
