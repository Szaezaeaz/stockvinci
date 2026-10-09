import React from 'react';

// Icônes en ligne (traits), pas d'emoji — utilisées pour la navigation du bas.
const base = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
};

export function IconBox(props) {
    return (
        <svg {...base} {...props}>
            <path d="M21 8 12 3 3 8l9 5 9-5Z" />
            <path d="M3 8v8l9 5 9-5V8" />
            <path d="M12 13v8" />
        </svg>
    );
}

export function IconSwap(props) {
    return (
        <svg {...base} {...props}>
            <path d="M17 3 21 7l-4 4" />
            <path d="M3 7h18" />
            <path d="M7 21 3 17l4-4" />
            <path d="M21 17H3" />
        </svg>
    );
}

export function IconClock(props) {
    return (
        <svg {...base} {...props}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
        </svg>
    );
}

// Bloc chargeur secteur USB (chargeur de téléphone). Illustration en couleurs,
// dimensionnée en em pour suivre la taille de police de l'endroit où elle est affichée.
export function IconPhoneCharger(props) {
    return (
        <svg width="1em" height="1em" viewBox="0 0 24 24" style={{ verticalAlign: 'middle' }} aria-hidden="true" {...props}>
            <rect x="8" y="1" width="2" height="5" rx="0.8" fill="#94a3b8" />
            <rect x="14" y="1" width="2" height="5" rx="0.8" fill="#94a3b8" />
            <rect x="5" y="5.5" width="14" height="17.5" rx="3" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.4" />
            <rect x="8.5" y="12" width="7" height="3.6" rx="0.9" fill="#334155" />
            <rect x="10" y="13.2" width="4" height="1.2" rx="0.4" fill="#94a3b8" />
        </svg>
    );
}
