import React, { useRef, useState } from 'react';
import KeyboardToggle from './KeyboardToggle';
import OnScreenKeyboard from './OnScreenKeyboard';
import { isKeyboardPrefOn, setKeyboardPref, useKeyboardPref } from '../hooks/useKeyboardPref';

// Barre de recherche. Le bouton clavier ouvre le clavier à l'écran de l'appli (avec les
// chiffres, pour les n° de série) quand celui de la tablette n'apparaît pas.
export default function SearchBar({ value, onChange, placeholder = 'Rechercher…' }) {
    const keyboardOn = useKeyboardPref();
    const [keyboardShown, setKeyboardShown] = useState(false);
    const [shiftOnce, setShiftOnce] = useState(false);
    const inputRef = useRef(null);

    const typeChar = (char) => {
        if (char === ' ' && (value === '' || /\s$/.test(value))) return;
        onChange(value + (shiftOnce ? char.toUpperCase() : char));
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
        <div className="search-bar-wrap">
            <div className="search-bar">
                <svg className="search-bar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                    ref={inputRef}
                    type="text"
                    className="search-bar-input"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={showIfPreferred}
                    onClick={showIfPreferred}
                    placeholder={placeholder}
                    inputMode={keyboardOn ? 'none' : undefined}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="search"
                />
                {value && (
                    <button type="button" className="search-bar-clear" onClick={() => onChange('')} aria-label="Effacer la recherche">
                        &times;
                    </button>
                )}
                <KeyboardToggle active={keyboardShown} onToggle={toggleKeyboard} />
            </div>

            {keyboardShown && (
                <OnScreenKeyboard
                    digits
                    upper={shiftOnce}
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
