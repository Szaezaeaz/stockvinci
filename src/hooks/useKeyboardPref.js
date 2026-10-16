import { useSyncExternalStore } from 'react';

// Préférence de l'appareil : utiliser le clavier à l'écran de l'appli plutôt que
// celui de la tablette (qui disparaît quand la douchette est branchée). Partagée par
// tous les champs qui le proposent (noms, recherches) : l'activer ici l'active partout.
const KEY = 'vinci_onscreen_keyboard';
const listeners = new Set();

function read() {
    try {
        return localStorage.getItem(KEY) === '1';
    } catch {
        return false;
    }
}

let current = read();

export const isKeyboardPrefOn = () => current;

export function setKeyboardPref(on) {
    current = on;
    try {
        localStorage.setItem(KEY, on ? '1' : '0');
    } catch {
        // stockage indisponible : la préférence ne sera simplement pas retenue
    }
    listeners.forEach(listener => listener());
}

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useKeyboardPref = () => useSyncExternalStore(subscribe, isKeyboardPrefOn);
