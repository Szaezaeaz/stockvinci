import React, { useEffect, useRef } from 'react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Saisie d'un code PIN : points + pavé numérique à l'écran. Le champ accepte aussi
// les chiffres d'un clavier physique ; le clavier de la tablette ne s'ouvre pas.
export default function PinPad({ value, onChange, onSubmit, label = 'Code', autoFocus = false, maxLength = 12, submitLabel = 'OK' }) {
    const inputRef = useRef(null);

    useEffect(() => {
        if (autoFocus) inputRef.current?.focus();
    }, [autoFocus]);

    const press = (digit) => {
        if (value.length < maxLength) onChange(value + digit);
    };

    return (
        <div className="pin-pad">
            <label className="pin-label">{label}</label>
            <input
                ref={inputRef}
                type="password"
                className="pin-input"
                value={value}
                onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, maxLength))}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        onSubmit?.();
                    }
                }}
                inputMode="none"
                autoComplete="off"
                aria-label={label}
                placeholder="••••••"
            />
            <div className="pin-keys">
                {KEYS.map(key => (
                    <button key={key} type="button" className="pin-key" onMouseDown={(e) => e.preventDefault()} onClick={() => press(key)}>{key}</button>
                ))}
                <button type="button" className="pin-key pin-key-muted" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(value.slice(0, -1))} aria-label="Effacer">⌫</button>
                <button type="button" className="pin-key" onMouseDown={(e) => e.preventDefault()} onClick={() => press('0')}>0</button>
                {onSubmit ? (
                    <button type="button" className="pin-key pin-key-ok" onMouseDown={(e) => e.preventDefault()} onClick={onSubmit}>{submitLabel}</button>
                ) : (
                    <span />
                )}
            </div>
        </div>
    );
}
