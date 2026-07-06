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
