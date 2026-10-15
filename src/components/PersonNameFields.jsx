import React, { useContext, useRef, useState } from 'react';
import OnScreenKeyboard from './OnScreenKeyboard';
import { PeopleContext } from '../utils/PeopleContext';
import { findPeople, nameKey } from '../utils/person';

// Préférence de l'appareil : utiliser le clavier à l'écran de l'appli plutôt que
// celui de la tablette (qui disparaît quand la douchette est branchée).
const KEYBOARD_PREF = 'vinci_onscreen_keyboard';
const readKeyboardPref = () => {
    try {
        return localStorage.getItem(KEYBOARD_PREF) === '1';
    } catch {
        return false;
    }
};
const saveKeyboardPref = (on) => {
    try {
        localStorage.setItem(KEYBOARD_PREF, on ? '1' : '0');
    } catch {
        // stockage indisponible : la préférence ne sera simplement pas retenue
    }
};

// Saisie d'un collaborateur en deux champs : NOM (mis en majuscules tout seul) et
// Prénom. "Entrée" dans le NOM passe au Prénom. Les personnes déjà connues dont le nom
// ressemble à la saisie sont proposées dessous (accents et majuscules ignorés) : un
// clic remplit les deux champs. Un clavier AZERTY propre à l'appli peut remplacer
// celui de la tablette. L'appelant réunit les deux champs avec fullName (utils/person).
export default function PersonNameFields({ last, first, onLastChange, onFirstChange, lastRef, autoFocus = false, required = false }) {
    const people = useContext(PeopleContext);
    const firstRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [keyboardOn, setKeyboardOn] = useState(readKeyboardPref); // préférence de l'appareil
    const [keyboardShown, setKeyboardShown] = useState(() => autoFocus && readKeyboardPref()); // champ actif dès l'ouverture : le clavier suit
    const [active, setActive] = useState('last'); // champ qui reçoit le clavier à l'écran
    const [shiftOnce, setShiftOnce] = useState(false);

    const lastKey = nameKey(last);
    const firstKey = nameKey(first);
    // Une personne dont le nom est déjà saisi en entier n'a plus besoin d'être proposée.
    // Avec le clavier à l'écran, le champ perd le focus à chaque touche : on garde la liste.
    const suggestions = open || keyboardShown
        ? findPeople(people, last, first).filter(person => person.lastKey !== lastKey || person.firstKey !== firstKey)
        : [];

    const pick = (person) => {
        onLastChange(person.last);
        onFirstChange(person.first);
        setOpen(false);
    };

    const focusField = (field) => {
        setActive(field);
        setOpen(true);
        if (keyboardOn) setKeyboardShown(true);
    };

    // --- clavier à l'écran -----------------------------------------------------
    const current = active === 'last' ? last : first;
    const setCurrent = active === 'last' ? onLastChange : onFirstChange;
    // Le NOM est toujours en majuscules ; le Prénom commence par une majuscule, après
    // une espace, un tiret ou une apostrophe.
    const autoCapital = active === 'first' && (first === '' || /[\s'’-]$/.test(first));
    const upper = active === 'last' || shiftOnce || autoCapital;

    const typeChar = (char) => {
        if (char === ' ' && (current === '' || /\s$/.test(current))) return;
        setCurrent(current + (upper ? char.toUpperCase() : char));
        setShiftOnce(false);
    };
    const backspace = () => setCurrent(current.slice(0, -1));
    const next = () => {
        if (active === 'last') {
            setActive('first');
            firstRef.current?.focus();
        } else {
            setKeyboardShown(false);
            setOpen(false);
        }
    };

    const enableKeyboard = () => {
        setKeyboardOn(true);
        saveKeyboardPref(true);
        setKeyboardShown(true);
    };
    const disableKeyboard = () => {
        setKeyboardOn(false);
        saveKeyboardPref(false);
        setKeyboardShown(false);
    };

    const inputMode = keyboardOn ? 'none' : undefined; // pas de clavier de la tablette en plus
    // Toucher un champ le rend actif pour le clavier à l'écran, même s'il avait déjà le focus.
    const touchField = (field) => {
        setActive(field);
        if (keyboardOn) setKeyboardShown(true);
    };

    return (
        <div className="name-picker">
            <div className="name-fields">
                <input
                    type="text"
                    className="loan-input"
                    ref={lastRef}
                    placeholder="NOM"
                    aria-label="NOM"
                    value={last}
                    onChange={(e) => { onLastChange(e.target.value.toUpperCase()); setOpen(true); }}
                    onFocus={() => focusField('last')}
                    onClick={() => touchField('last')}
                    onBlur={() => setOpen(false)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            firstRef.current?.focus();
                        }
                    }}
                    inputMode={inputMode}
                    autoFocus={autoFocus}
                    required={required}
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
                <input
                    type="text"
                    className="loan-input"
                    ref={firstRef}
                    placeholder="Prénom"
                    aria-label="Prénom"
                    value={first}
                    onChange={(e) => { onFirstChange(e.target.value); setOpen(true); }}
                    onFocus={() => focusField('first')}
                    onClick={() => touchField('first')}
                    onBlur={() => setOpen(false)}
                    inputMode={inputMode}
                    required={required}
                    autoCapitalize="words"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
            </div>

            {suggestions.length > 0 && (
                <ul className="name-suggestions">
                    {suggestions.map(person => (
                        <li key={person.name}>
                            {/* mouseDown : le champ garde le focus, la liste ne disparaît pas avant le clic */}
                            <button type="button" className="name-suggestion" onMouseDown={(e) => { e.preventDefault(); pick(person); }}>
                                <span>{person.name}</span>
                                {person.devices > 0 && <small>{person.devices} appareil{person.devices > 1 ? 's' : ''}</small>}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {keyboardShown && (
                <OnScreenKeyboard
                    upper={upper}
                    shiftOn={shiftOnce}
                    onShift={() => setShiftOnce(on => !on)}
                    onChar={typeChar}
                    onBackspace={backspace}
                    onNext={next}
                    nextLabel={active === 'last' ? 'Prénom ›' : 'OK'}
                />
            )}

            <div className="name-keyboard-links">
                {keyboardShown ? (
                    <button type="button" className="scan-link" onClick={() => setKeyboardShown(false)}>Masquer le clavier à l’écran</button>
                ) : (
                    <button type="button" className="scan-link" onClick={keyboardOn ? () => setKeyboardShown(true) : enableKeyboard}>
                        Clavier à l’écran
                    </button>
                )}
                {keyboardOn && (
                    <button type="button" className="scan-link" onClick={disableKeyboard}>Revenir au clavier de la tablette</button>
                )}
            </div>
        </div>
    );
}
