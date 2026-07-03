import { useCallback, useRef, useState } from 'react';

const LONG_PRESS_DELAY = 500;

// Stepper +/- classique. Rester appuyé 0,5s sur un bouton fait apparaître un
// petit popup proposant des sauts rapides (+5/+10 ou -5/-10 selon le bouton).
export default function QuantityStepper({ value, onChange, min = 0 }) {
    const [popup, setPopup] = useState(null); // 'plus' | 'minus' | null
    const timerRef = useRef(null);
    const longPressFiredRef = useRef(false);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const startPress = useCallback((which) => {
        longPressFiredRef.current = false;
        clearTimer();
        timerRef.current = setTimeout(() => {
            longPressFiredRef.current = true;
            setPopup(which);
        }, LONG_PRESS_DELAY);
    }, [clearTimer]);

    const handleClick = useCallback((which) => {
        clearTimer();
        if (longPressFiredRef.current) {
            // Le popup gère déjà l'action, on ignore ce clic de relâchement.
            longPressFiredRef.current = false;
            return;
        }
        const delta = which === 'plus' ? 1 : -1;
        onChange(Math.max(min, value + delta));
    }, [clearTimer, min, onChange, value]);

    const applyStep = useCallback((step) => {
        onChange(Math.max(min, value + step));
        setPopup(null);
    }, [min, onChange, value]);

    return (
        <div className="qty-stepper">
            <div className="qty-stepper-row">
                <button
                    type="button"
                    className="btn-mini btn-minus"
                    onMouseDown={() => startPress('minus')}
                    onMouseUp={clearTimer}
                    onMouseLeave={clearTimer}
                    onTouchStart={() => startPress('minus')}
                    onTouchEnd={clearTimer}
                    onClick={() => handleClick('minus')}
                >
                    -
                </button>
                <span className="qty-stepper-value">{value}</span>
                <button
                    type="button"
                    className="btn-mini btn-plus"
                    onMouseDown={() => startPress('plus')}
                    onMouseUp={clearTimer}
                    onMouseLeave={clearTimer}
                    onTouchStart={() => startPress('plus')}
                    onTouchEnd={clearTimer}
                    onClick={() => handleClick('plus')}
                >
                    +
                </button>
            </div>

            {popup && (
                <div className="qty-popup">
                    <button type="button" onClick={() => applyStep(popup === 'plus' ? 5 : -5)}>
                        {popup === 'plus' ? '+5' : '-5'}
                    </button>
                    <button type="button" onClick={() => applyStep(popup === 'plus' ? 10 : -10)}>
                        {popup === 'plus' ? '+10' : '-10'}
                    </button>
                    <button type="button" className="qty-popup-close" onClick={() => setPopup(null)} aria-label="Fermer">
                        ×
                    </button>
                </div>
            )}
        </div>
    );
}
