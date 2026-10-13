import React, { useRef } from 'react';

// Saisie d'un collaborateur en deux champs : NOM (mis en majuscules tout seul) et
// Prénom. "Entrée" dans le NOM passe au Prénom. L'appelant réunit les deux avec
// fullName (utils/person).
export default function PersonNameFields({ last, first, onLastChange, onFirstChange, lastRef, autoFocus = false, required = false }) {
    const firstRef = useRef(null);

    return (
        <div className="name-fields">
            <input
                type="text"
                className="loan-input"
                ref={lastRef}
                placeholder="NOM"
                aria-label="NOM"
                value={last}
                onChange={(e) => onLastChange(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        firstRef.current?.focus();
                    }
                }}
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
                onChange={(e) => onFirstChange(e.target.value)}
                required={required}
                autoCapitalize="words"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
            />
        </div>
    );
}
