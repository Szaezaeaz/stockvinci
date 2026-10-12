import { normalizeSerial } from './serial';
import { matchModelName } from './models';

// Le QR code d'un PC HP contient "N°SÉRIE,RÉFÉRENCE,MODÈLE,..." ; un code-barres
// simple (ou le QR d'un téléphone) ne contient que le numéro de série.
// model : modèle exact reconnu, ou null (candidates liste alors les modèles
// possibles quand le nom lu en désigne plusieurs).
export function parseScan(raw) {
    const text = String(raw || '').trim();
    if (!text.includes(',')) {
        return { serial: normalizeSerial(text), productId: '', modelName: '', model: null, candidates: [] };
    }
    const [serial, productId = '', modelName = ''] = text.split(',').map(part => part.trim());
    return {
        serial: normalizeSerial(serial),
        productId,
        modelName,
        ...matchModelName(modelName, productId)
    };
}
