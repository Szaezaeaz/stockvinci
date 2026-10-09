import { useEffect, useRef, useState } from 'react';

// Une douchette "tape" les caractères en rafale (quelques ms entre deux) puis
// Entrée (ou Tab). On valide le scan à Entrée/Tab, ou quand une rafale s'arrête
// (douchette sans Entrée). Une saisie à la main est trop lente pour ça.
const BURST_GAP_MS = 60;
const BURST_MIN_CHARS = 5;
const BURST_IDLE_MS = 250;

// Capture d'un champ de scan. La valeur du champ appartient à l'appelant
// (value / setValue) ; onScan(texte) est appelé à la fin de chaque scan.
// redirectKeys : si le focus est sur un élément qui n'est pas un champ de saisie
// (liste déroulante, bouton…), la première touche est redirigée vers ce champ
// pour que le scan ne soit pas perdu ni ne change une liste déroulante.
export function useScanCapture({ value, setValue, onScan, redirectKeys = false }) {
    const [focused, setFocused] = useState(false);
    const inputRef = useRef(null);
    const lastChangeRef = useRef(0);
    const burstRef = useRef(0);
    const idleTimerRef = useRef(null);
    const onScanRef = useRef(onScan);
    const handleValueRef = useRef(null);

    const trigger = (raw) => {
        clearTimeout(idleTimerRef.current);
        burstRef.current = 0;
        const text = String(raw || '').trim();
        if (text) onScanRef.current(text);
    };

    const handleValue = (next) => {
        setValue(next);

        const now = Date.now();
        burstRef.current = now - lastChangeRef.current < BURST_GAP_MS ? burstRef.current + 1 : 1;
        lastChangeRef.current = now;

        clearTimeout(idleTimerRef.current);
        if (burstRef.current >= BURST_MIN_CHARS) {
            idleTimerRef.current = setTimeout(() => trigger(next), BURST_IDLE_MS);
        }
    };

    useEffect(() => {
        onScanRef.current = onScan;
        handleValueRef.current = handleValue;
    });

    useEffect(() => () => clearTimeout(idleTimerRef.current), []);

    useEffect(() => {
        if (!redirectKeys) return undefined;
        const onKeyDown = (e) => {
            const input = inputRef.current;
            if (!input || document.activeElement === input) return;
            if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            e.preventDefault();
            input.focus();
            input.value += e.key;
            handleValueRef.current(input.value);
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [redirectKeys]);

    const onKeyDown = (e) => {
        const text = e.currentTarget.value;
        if (e.key === 'Enter' || (e.key === 'Tab' && text)) {
            e.preventDefault();
            trigger(text);
        }
    };

    const refocus = () => setTimeout(() => inputRef.current?.focus(), 0);

    return {
        focused,
        refocus,
        inputProps: {
            ref: inputRef,
            value,
            onChange: (e) => handleValue(e.target.value),
            onKeyDown,
            onFocus: () => setFocused(true),
            onBlur: () => setFocused(false)
        }
    };
}
