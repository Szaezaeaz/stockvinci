import { useState, useEffect } from 'react';
import { sendLowStockAlert } from '../services/email';
import { LOW_STOCK_THRESHOLD } from '../config/thresholds';

const STORAGE_KEY = 'vinci_inventory_v3';

const INITIAL_STATE = {
    stock: {
        '650 G11 Neuf': 5,
        '650 G11 Occasion': 5,
        '850 G8 Occasion': 0,
        Casque: 10,
        Souris: 20,
        Clavier: 10,
        Sacoche: 15,
        'Sac à Dos': 0,
        Chargeur: 20,
        Dock: 10,
        Écran: 0,
        'iPhone 16e': 5,
        'Samsung XCOVER 7': 5,
        'Samsung A36': 0
    },
    history: [],
    loans: [] // Array of { id, name, date }
};

// Maps legacy generic category names (pre-model-tracking) to their closest
// specific replacement, so existing on-device stock counts aren't lost when
// this update lands on a tablet that already has real inventory data.
const LEGACY_KEY_MIGRATIONS = {
    'PC Neuf': '650 G11 Neuf',
    'PC Occasion': '650 G11 Occasion',
    Iphone: 'iPhone 16e',
    Xcover: 'Samsung XCOVER 7'
};

function migrateLegacyStock(stock) {
    const migrated = { ...stock };
    for (const [legacyKey, newKey] of Object.entries(LEGACY_KEY_MIGRATIONS)) {
        if (migrated[legacyKey] !== undefined) {
            migrated[newKey] = (migrated[newKey] || 0) + migrated[legacyKey];
            delete migrated[legacyKey];
        }
    }
    return migrated;
}

export function useInventory() {
    const [data, setData] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return {
                    stock: { ...INITIAL_STATE.stock, ...migrateLegacyStock(parsed.stock || {}) },
                    history: parsed.history || [],
                    loans: parsed.loans || []
                };
            } catch (e) {
                console.error('Failed to parse inventory data', e);
            }
        }
        return INITIAL_STATE;
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, [data]);



    // ... (existing imports and constants)

    const updateStock = (category, delta, recipient = null) => {
        setData(prev => {
            const prevCount = prev.stock[category] || 0;
            const newCount = prevCount + delta;
            if (newCount < 0) return prev;

            // Trigger Email Alert when any category crosses below the low-stock threshold
            if (prevCount >= LOW_STOCK_THRESHOLD && newCount < LOW_STOCK_THRESHOLD && delta < 0) {
                sendLowStockAlert(category, newCount);
            }

            const newHistoryItem = {
                id: Date.now(),
                category,
                delta,
                count: newCount,
                date: new Date(),
                recipient // Add recipient tracking
            };

            return {
                ...prev,
                stock: { ...prev.stock, [category]: newCount },
                history: [newHistoryItem, ...prev.history].slice(0, 50)
            };
        });
    };

    const addLoan = (name, pcType, phoneType, accessories = { mouse: true, headset: true, bag: true }) => {
        setData(prev => {
            const stockUpdates = {};
            // We won't push individual history updates anymore.
            // We will push ONE composite "Loan Package" update.

            const loanedItems = [];
            const newDate = new Date();

            // Helper to process deduction
            const processDeduction = (item) => {
                if (!item || item === 'Aucun') return true;
                const currentQty = (prev.stock[item] || 0) + (stockUpdates[item] || 0);
                if (currentQty <= 0) return false; // Stock insufficient

                stockUpdates[item] = (stockUpdates[item] || 0) - 1;

                // Check for alert on this item (pre-calculation)
                const newQty = currentQty - 1;
                if (currentQty >= LOW_STOCK_THRESHOLD && newQty < LOW_STOCK_THRESHOLD) {
                    sendLowStockAlert(item, newQty);
                }

                loanedItems.push(item);
                return true;
            };

            // Deduct items
            const canDeductPC = processDeduction(pcType);
            const canDeductMouse = accessories.mouse ? processDeduction('Souris') : true;
            const canDeductHeadset = accessories.headset ? processDeduction('Casque') : true;
            const canDeductBag = accessories.bag ? processDeduction('Sacoche') : true;
            const canDeductPhone = phoneType !== 'Aucun' ? processDeduction(phoneType) : true;

            if (!canDeductPC || !canDeductMouse || !canDeductHeadset || !canDeductBag || !canDeductPhone) {
                alert("Stock insuffisant pour un ou plusieurs articles !");
                return prev;
            }

            // Apply updates
            const newStock = { ...prev.stock };
            for (const [item, delta] of Object.entries(stockUpdates)) {
                newStock[item] = (newStock[item] || 0) + delta;
            }

            // Create Single Composite History Entry
            const loanPackageEntry = {
                id: Date.now(),
                category: 'Prêt PC', // Special category for display
                delta: -1, // Logical decrement (1 package out)
                recipient: name,
                details: loanedItems, // Array of what was in the package
                date: newDate
            };

            const newLoan = {
                id: Date.now(),
                name,
                date: newDate,
                items: loanedItems
            };

            return {
                ...prev,
                stock: newStock,
                history: [loanPackageEntry, ...prev.history].slice(0, 50),
                loans: [...prev.loans, newLoan]
            };
        });
    };

    const addWithdrawal = (recipient, type, items) => {
        setData(prev => {
            const stockUpdates = {};
            const withdrawnItemsList = [];
            const newDate = new Date();

            // items is Array of { id, count }
            // 1. Calculate Deductions & Validations
            for (const { id, count } of items) {
                const currentStock = (prev.stock[id] || 0) + (stockUpdates[id] || 0);
                if (currentStock < count) {
                    alert(`Stock insuffisant pour ${id} (Demandé: ${count}, Dispo: ${currentStock})`);
                    return prev;
                }

                stockUpdates[id] = (stockUpdates[id] || 0) - count;

                // Alerts logic
                const newQty = currentStock - count;
                if (currentStock >= LOW_STOCK_THRESHOLD && newQty < LOW_STOCK_THRESHOLD) {
                    sendLowStockAlert(id, newQty);
                }

                // Add to list for history details
                // If count > 1, show "Souris (x2)"
                const itemLabel = count > 1 ? `${id} (x${count})` : id;
                withdrawnItemsList.push(itemLabel);
            }

            // 2. Apply Stock Updates
            const newStock = { ...prev.stock };
            for (const [id, delta] of Object.entries(stockUpdates)) {
                newStock[id] = (newStock[id] || 0) + delta;
            }

            // 3. Create History Entry
            const typeLabel = type === 'don' ? 'Don' : 'Prêt Temp.';
            const historyEntry = {
                id: Date.now(),
                category: `Retrait (${typeLabel})`,
                delta: -1, // Logical decrement for grouping
                recipient: recipient,
                details: withdrawnItemsList,
                date: newDate
            };

            const newState = {
                ...prev,
                stock: newStock,
                history: [historyEntry, ...prev.history].slice(0, 50)
            };

            // 4. If type is 'pret', save it as an active loan
            if (type === 'pret') {
                const newLoan = {
                    id: Date.now(), // Unique ID for this loan
                    name: recipient,
                    recipient,
                    items: withdrawnItemsList,
                    date: newDate
                };
                newState.loans = [...prev.loans, newLoan];
            }

            return newState;
        });
    };

    const returnLoan = (loanId) => {
        setData(prev => {
            const loan = prev.loans.find(l => l.id === loanId);
            if (!loan) return prev;

            const stockUpdates = {};
            // Parse items from "Souris (x2)" or "Casque" strings
            loan.items.forEach(itemStr => {
                let id = itemStr;
                let count = 1;
                // Check for (xN) pattern
                const match = itemStr.match(/(.+) \(x(\d+)\)/);
                if (match) {
                    id = match[1];
                    count = parseInt(match[2], 10);
                }
                stockUpdates[id] = (stockUpdates[id] || 0) + count;
            });

            // Update Stock
            const newStock = { ...prev.stock };
            for (const [id, count] of Object.entries(stockUpdates)) {
                newStock[id] = (newStock[id] || 0) + count;
            }

            // History Log
            const historyEntry = {
                id: Date.now(),
                category: 'Retour Prêt',
                delta: 1,
                recipient: loan.recipient,
                details: loan.items,
                date: new Date()
            };

            return {
                ...prev,
                stock: newStock,
                history: [historyEntry, ...prev.history].slice(0, 50),
                loans: prev.loans.filter(l => l.id !== loanId) // Remove from active loans
            };
        });
    };

    const quickReturnPC = (pcModel = '650 G11 Occasion', accessories = { mouse: true, charger: true, headset: false, bag: false }) => {
        setData(prev => {
            const stockUpdates = { [pcModel]: 1 };
            const returnedItemsLog = [pcModel];

            if (accessories.mouse) { stockUpdates['Souris'] = 1; returnedItemsLog.push('Souris'); }
            if (accessories.charger) { stockUpdates['Chargeur'] = 1; returnedItemsLog.push('Chargeur'); }
            if (accessories.headset) { stockUpdates['Casque'] = 1; returnedItemsLog.push('Casque'); }
            if (accessories.bag) { stockUpdates['Sacoche'] = 1; returnedItemsLog.push('Sacoche'); }

            // Update Stock
            const newStock = { ...prev.stock };
            for (const [id, count] of Object.entries(stockUpdates)) {
                newStock[id] = (newStock[id] || 0) + count;
            }

            // History Log
            const historyEntry = {
                id: Date.now(),
                category: 'Retour PC (Rapide)',
                delta: 1,
                recipient: 'Anonyme',
                details: returnedItemsLog,
                date: new Date()
            };

            return {
                ...prev,
                stock: newStock,
                history: [historyEntry, ...prev.history].slice(0, 50)
            };
        });
    };

    const removeLoan = (id) => {
        setData(prev => ({
            ...prev,
            loans: prev.loans.filter(loan => loan.id !== id)
        }));
    };

    return {
        stock: data.stock,
        history: data.history,
        loans: data.loans,
        updateStock,
        addLoan,
        addWithdrawal,
        removeLoan,
        returnLoan,
        quickReturnPC
    };
}
