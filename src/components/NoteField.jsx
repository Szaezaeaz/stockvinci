import React, { useContext, useRef, useState } from 'react';
import KeyboardToggle from './KeyboardToggle';
import OnScreenKeyboard from './OnScreenKeyboard';
import { isKeyboardPrefOn, setKeyboardPref, useKeyboardPref } from '../hooks/useKeyboardPref';
import { NotePresetsContext } from '../utils/NotePresetsContext';

// Commentaire facultatif d'un changement d'état (attribution, remise, retour, fiche
// d'un appareil). Les phrases courantes (presets) se remplissent d'un toucher ; celles
// ajoutées par l'équipe ("+ Enregistrer comme commentaire type") suivent, avec un ×
// pour les retirer. Le bouton clavier ouvre le clavier de l'appli.
export default function NoteField({ value, onChange, presets = [], label = 'Commentaire', placeholder = 'Ex. : remis aux assistantes, mis de côté jusqu’en janvier…', autoFocus = false }) {
    const keyboardOn = useKeyboardPref();
    const [keyboardShown, setKeyboardShown] = useState(() => autoFocus && isKeyboardPrefOn());
    const [shiftOnce, setShiftOnce] = useState(false);
    const inputRef = useRef(null);
    const team = useContext(NotePresetsContext);
    const custom = team.custom.filter(preset => !presets.includes(preset));
    const typed = value.replace(/\s+/g, ' ').trim();
    const canSave = typed !== '' && !presets.includes(typed) && !team.custom.includes(typed);

    const removePreset = (preset) => {
        if (window.confirm(`Retirer le commentaire type « ${preset} » ? Il ne sera plus proposé sur aucune tablette.`)) team.remove(preset);
    };

    // Première lettre en majuscule, comme une phrase.
    const upper = shiftOnce || value === '';
    const typeChar = (char) => {
        if (char === ' ' && (value === '' || /\s$/.test(value))) return;
        onChange(value + (upper ? char.toUpperCase() : char));
        setShiftOnce(false);
    };

    const toggleKeyboard = () => {
        if (keyboardShown) {
            setKeyboardShown(false);
            return;
        }
        if (!isKeyboardPrefOn()) setKeyboardPref(true);
        setKeyboardShown(true);
        inputRef.current?.focus();
    };
    const showIfPreferred = () => { if (keyboardOn) setKeyboardShown(true); };

    return (
        <div className="form-group note-field">
            <label>{label} <small className="note-optional">(facultatif)</small></label>
            <div className="note-input-wrap">
                <input
                    ref={inputRef}
                    type="text"
                    className="loan-input"
                    value={value}
                    maxLength={200}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={showIfPreferred}
                    onClick={showIfPreferred}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                    placeholder={placeholder}
                    inputMode={keyboardOn ? 'none' : undefined}
                    autoFocus={autoFocus}
                    autoComplete="off"
                    autoCapitalize="sentences"
                />
                <KeyboardToggle active={keyboardShown} onToggle={toggleKeyboard} />
            </div>

            <div className="note-presets">
                {presets.map(preset => (
                    <button
                        key={preset}
                        type="button"
                        className={`note-preset${value === preset ? ' active' : ''}`}
                        onClick={() => onChange(value === preset ? '' : preset)}
                    >
                        {preset}
                    </button>
                ))}
                {custom.map(preset => (
                    <span key={preset} className={`note-preset note-preset-custom${value === preset ? ' active' : ''}`}>
                        <button type="button" onClick={() => onChange(value === preset ? '' : preset)}>{preset}</button>
                        <button type="button" className="note-preset-remove" onClick={() => removePreset(preset)} aria-label={`Retirer le commentaire type ${preset}`}>&times;</button>
                    </span>
                ))}
                {canSave && (
                    <button type="button" className="note-preset note-preset-save" onClick={() => team.add(typed)}>
                        + Enregistrer comme commentaire type
                    </button>
                )}
            </div>

            {keyboardShown && (
                <OnScreenKeyboard
                    digits
                    upper={upper}
                    shiftOn={shiftOnce}
                    onShift={() => setShiftOnce(on => !on)}
                    onChar={typeChar}
                    onBackspace={() => onChange(value.slice(0, -1))}
                    onNext={() => setKeyboardShown(false)}
                    nextLabel="OK"
                    onUseDeviceKeyboard={() => { setKeyboardPref(false); setKeyboardShown(false); }}
                />
            )}
        </div>
    );
}
