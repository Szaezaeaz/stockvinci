// N° de série des appareils (PC, téléphone) rattachés à une attribution.
// Les anciennes attributions n'avaient qu'un seul PC, stocké dans `pcSerial`.
export function getLoanSerials(loan) {
    if (Array.isArray(loan?.serials)) return loan.serials;
    return loan?.pcSerial ? [loan.pcSerial] : [];
}
