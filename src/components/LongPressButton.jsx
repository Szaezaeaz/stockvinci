import { useCallback, useRef } from 'react';

const LONG_PRESS_DELAY = 3000;
const LONG_PRESS_MULTIPLIER = 5;

// Un clic normal appelle onPress(1). Un appui maintenu 3s appelle onPress(5)
// une seule fois, et le clic qui suit le relâchement est ignoré.
export default function LongPressButton({ className, ariaLabel, onPress, children }) {
    const timerRef = useRef(null);
    const longPressFiredRef = useRef(false);

    const startPress = useCallback(() => {
        longPressFiredRef.current = false;
        timerRef.current = setTimeout(() => {
            longPressFiredRef.current = true;
            onPress(LONG_PRESS_MULTIPLIER);
        }, LONG_PRESS_DELAY);
    }, [onPress]);

    const cancelPress = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const handleClick = useCallback(() => {
        if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            return;
        }
        onPress(1);
    }, [onPress]);

    return (
        <button
            type="button"
            className={className}
            aria-label={ariaLabel}
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onClick={handleClick}
        >
            {children}
        </button>
    );
}
