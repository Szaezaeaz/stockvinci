// Types d'appareils suivis par n° de série.
export const KIND_ICONS = { pc: '💻', phone: '📱', screen: '🖥️' };
export const kindIcon = (kind) => KIND_ICONS[kind] || '💻';
// "un PC", "un téléphone", "un écran"
export const KIND_NAMES = { pc: 'un PC', phone: 'un téléphone', screen: 'un écran' };
