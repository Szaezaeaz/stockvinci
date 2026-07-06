import { getLowStockThreshold } from '../config/thresholds';

export function getStockStats(stock) {
    const entries = Object.entries(stock);
    const totalUnits = entries.reduce((sum, [, count]) => sum + (count || 0), 0);
    const outOfStock = entries.filter(([, count]) => (count || 0) <= 0).length;
    const lowStock = entries.filter(([key, count]) => {
        const threshold = getLowStockThreshold(key);
        return threshold > 0 && count > 0 && count < threshold;
    }).length;
    return { totalUnits, references: entries.length, outOfStock, lowStock };
}
