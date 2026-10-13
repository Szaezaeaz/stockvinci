import React, { useState } from 'react';
import Modal from './Modal';
import SearchBar from './SearchBar';
import { matchesQuery } from '../utils/search';
import { exactNamesOf, groupOfModel, kindOfModel, listModelChoices, modelLabel, modelOf, shortModelName } from '../utils/models';

const GROUP_ORDER = ['PC', 'iPhone', 'Android'];

// Modèles précis regroupés sous un modèle de l'appli, rappelés sous son nom
// ("660 G11" : EliteBook 660 16" G11).
function exactHint(model) {
    const names = exactNamesOf(model).map(shortModelName).filter(name => name !== model);
    return names.join(', ');
}

// Choix d'un modèle parmi tous ceux du parc : un bouton qui ouvre la liste
// complète, avec une recherche (le parc compte plusieurs dizaines de modèles).
// Les modèles sont ceux de l'appli : les lignes de l'accueil ("660 G11",
// "Zbook"...) d'abord, puis les modèles qui n'en ont pas.
// value : modèle choisi, ou '' si aucun.
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
        ? listModelChoices(devices)
            .filter(name => !kind || kindOfModel(name) === kind)
            .filter(name => matchesQuery(query, [name, ...exactNamesOf(name)]))
        : [];
    const suggested = [...new Set(suggestions.map(modelOf))].filter(name => models.includes(name));
    const groups = GROUP_ORDER
        .map(group => ({ group, names: models.filter(name => groupOfModel(name) === group && !suggested.includes(name)) }))
        .filter(({ names }) => names.length > 0);

    const option = (name) => (
        <li key={name}>
            <button type="button" className={`model-option${name === modelOf(value) ? ' model-option-current' : ''}`} onClick={() => pick(name)}>
                <span className="model-option-name">{modelLabel(name)}</span>
                {exactHint(name) && <span className="model-option-hint">{exactHint(name)}</span>}
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
                <span>{value ? modelLabel(value) : placeholder}</span>
                <span className="model-picker-caret">▾</span>
            </button>

            <Modal isOpen={open} onClose={close} title="Choisir le modèle">
                <SearchBar value={query} onChange={setQuery} placeholder="Rechercher un modèle (ex. G11, 640, A36)…" />
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
