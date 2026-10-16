import React from 'react';

// Petit bouton "clavier" : ouvre ou ferme le clavier à l'écran de l'appli. Dans une
// barre de recherche il est placé dans le champ ; standalone : sa propre petite bulle,
// à côté des champs (NOM / Prénom).
export default function KeyboardToggle({ active, onToggle, standalone = false }) {
    return (
        <button
            type="button"
            className={`keyboard-toggle${standalone ? ' keyboard-toggle-standalone' : ''}${active ? ' active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onToggle}
            aria-label={active ? 'Masquer le clavier à l’écran' : 'Clavier à l’écran'}
            aria-pressed={active}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 15h6" />
            </svg>
        </button>
    );
}
