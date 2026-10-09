// Normalise un numéro de série saisi ou scanné : majuscules, sans espaces.
export function normalizeSerial(raw) {
    return String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
}
