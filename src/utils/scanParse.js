import { normalizeSerial } from './serial';

// Famille de PC reconnue à partir du nom de modèle gravé dans le QR code HP
// (ex. "HPELITEBOOK660G11" -> "650 G11"). Retourne null si inconnu.
export function modelFamilyFromName(modelName) {
    const name = String(modelName || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!name) return null;
    if (name.includes('X360')) return 'X360';
    if (name.includes('ZBOOK')) return 'Zbook';
    if (/850G(8|10)/.test(name)) return '850 G8/G10';
    if (name.includes('G11')) return '650 G11';
    return null;
}

// Nom de stock correspondant à une famille, en gardant l'état (Neuf/Occasion)
// choisi par l'utilisateur. Le 850 G8/G10 n'existe qu'en Occasion.
export function stockModelForFamily(family, condition) {
    if (family === '850 G8/G10') return '850 G8/G10 Occasion';
    return `${family} ${condition === 'Occasion' ? 'Occasion' : 'Neuf'}`;
}

// "650 G11 Neuf" -> "650 G11" (famille d'un modèle de stock).
export function familyOfModel(model) {
    return String(model || '').replace(/ (Neuf|Occasion)$/, '');
}

export function conditionOfModel(model) {
    return String(model).endsWith('Occasion') ? 'Occasion' : 'Neuf';
}

// Le QR code d'un PC HP contient "N°SÉRIE,RÉFÉRENCE,MODÈLE,..." ; un code-barres
// simple ne contient que le numéro de série.
export function parseScan(raw) {
    const text = String(raw || '').trim();
    if (!text.includes(',')) {
        return { serial: normalizeSerial(text), productId: '', modelName: '', family: null };
    }
    const [serial, productId = '', modelName = ''] = text.split(',').map(part => part.trim());
    return {
        serial: normalizeSerial(serial),
        productId,
        modelName,
        family: modelFamilyFromName(modelName)
    };
}
