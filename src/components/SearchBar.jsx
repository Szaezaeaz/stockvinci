import React from 'react';

export default function SearchBar({ value, onChange, placeholder = 'Rechercher…' }) {
    return (
        <div className="search-bar">
            <svg className="search-bar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
            </svg>
            <input
                type="text"
                className="search-bar-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
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
        </div>
    );
}
