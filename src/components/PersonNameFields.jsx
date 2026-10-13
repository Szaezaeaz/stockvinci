import React, { useContext, useRef, useState } from 'react';
import { PeopleContext } from '../utils/PeopleContext';
import { findPeople, nameKey } from '../utils/person';

// Saisie d'un collaborateur en deux champs : NOM (mis en majuscules tout seul) et
// Prénom. "Entrée" dans le NOM passe au Prénom. Les personnes déjà connues dont le nom
// ressemble à la saisie sont proposées dessous (accents et majuscules ignorés) : un
// clic remplit les deux champs. L'appelant réunit les deux avec fullName (utils/person).
export default function PersonNameFields({ last, first, onLastChange, onFirstChange, lastRef, autoFocus = false, required = false }) {
    const people = useContext(PeopleContext);
    const firstRef = useRef(null);
    const [open, setOpen] = useState(false);

    const lastKey = nameKey(last);
    const firstKey = nameKey(first);
    // Une personne dont le nom est déjà saisi en entier n'a plus besoin d'être proposée.
    const suggestions = open
        ? findPeople(people, last, first).filter(person => person.lastKey !== lastKey || person.firstKey !== firstKey)
        : [];

    const pick = (person) => {
        onLastChange(person.last);
        onFirstChange(person.first);
        setOpen(false);
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
                    onFocus={() => setOpen(true)}
                    onBlur={() => setOpen(false)}
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
                    onChange={(e) => { onFirstChange(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setOpen(false)}
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
        </div>
    );
}
