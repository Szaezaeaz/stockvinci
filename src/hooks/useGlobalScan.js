import { useEffect, useRef } from 'react';

// Même principe que useScanCapture : une douchette tape les caractères en
// rafale puis Entrée. Ici on écoute toute la page, mais seulement quand aucun
// champ de saisie n'est actif et qu'aucune fenêtre n'est ouverte (les fenêtres
// ont leur propre champ de scan). Une saisie à la main est trop lente pour
// être prise pour un scan.
const BURST_GAP_MS = 80;
const BURST_MIN_CHARS = 5;
const BURST_IDLE_MS = 250;

function isEditable(element) {
    if (!element) return false;
    const tag = element.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
}

export function useGlobalScan(onScan, enabled = true) {
    const onScanRef = useRef(onScan);

    useEffect(() => {
        onScanRef.current = onScan;
    });

    useEffect(() => {
        if (!enabled) return undefined;

        let buffer = '';
        let fastKeys = 0;
        let lastKeyTime = 0;
        let idleTimer = null;

        const reset = () => {
            clearTimeout(idleTimer);
            buffer = '';
            fastKeys = 0;
        };

        const isScan = () => buffer.length >= BURST_MIN_CHARS && fastKeys >= BURST_MIN_CHARS - 1;

        const flush = () => {
            const text = buffer;
            const scanned = isScan();
            reset();
            if (scanned) onScanRef.current(text);
        };

        const onKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (isEditable(e.target) || isEditable(document.activeElement)) {
                reset();
                return;
            }
            if (document.querySelector('.modal-overlay')) {
                reset();
                return;
            }

            if (e.key === 'Enter') {
                if (isScan()) {
                    e.preventDefault(); // évite de "cliquer" un bouton qui aurait le focus
                    flush();
                } else {
                    reset();
                }
                return;
            }

            if (e.key.length !== 1) return;

            const now = Date.now();
            if (now - lastKeyTime < BURST_GAP_MS && buffer) {
                buffer += e.key;
                fastKeys += 1;
            } else {
                buffer = e.key;
                fastKeys = 0;
            }
            lastKeyTime = now;

            clearTimeout(idleTimer);
            idleTimer = setTimeout(flush, BURST_IDLE_MS);
        };

        window.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            clearTimeout(idleTimer);
        };
    }, [enabled]);
}
