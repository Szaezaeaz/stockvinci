import React, { useRef, useState } from 'react';
import KeyboardToggle from './KeyboardToggle';
import OnScreenKeyboard from './OnScreenKeyboard';
import { isKeyboardPrefOn, setKeyboardPref, useKeyboardPref } from '../hooks/useKeyboardPref';

// Champ texte simple avec le bouton "clavier à l'écran" (nom à la connexion, nom d'un
// compte de l'équipe…). type="password" masque la saisie.
export default function KeyboardTextField({ value, onChange, placeholder, type = 'text', autoFocus = false, onEnter, ariaLabel }) {
    const keyboardOn = useKeyboardPref();
    const [keyboardShown, setKeyboardShown] = useState(() => autoFocus && isKeyboardPrefOn());
    const [shiftOnce, setShiftOnce] = useState(false);
    const inputRef = useRef(null);

    // Majuscule au début de chaque mot (noms).
    const upper = shiftOnce || value === '' || /[\s'’-]$/.test(value);
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
        <div className="keyboard-text-field">
            <div className="note-input-wrap">
                <input
                    ref={inputRef}
                    type={type}
                    className="loan-input"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={showIfPreferred}
                    onClick={showIfPreferred}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onEnter?.();
                        }
                    }}
                    placeholder={placeholder}
                    aria-label={ariaLabel || placeholder}
                    inputMode={keyboardOn ? 'none' : undefined}
                    autoFocus={autoFocus}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                />
                <KeyboardToggle active={keyboardShown} onToggle={toggleKeyboard} />
            </div>
            {keyboardShown && (
                <OnScreenKeyboard
                    digits
                    upper={upper}
                    shiftOn={shiftOnce}
                    onShift={() => setShiftOnce(on => !on)}
                    onChar={typeChar}
                    onBackspace={() => onChange(value.slice(0, -1))}
                    onNext={() => { setKeyboardShown(false); onEnter?.(); }}
                    nextLabel="OK"
                    onUseDeviceKeyboard={() => { setKeyboardPref(false); setKeyboardShown(false); }}
                />
            )}
        </div>
    );
}
