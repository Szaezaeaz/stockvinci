import { useState, useEffect } from 'react';
import { sendLowStockAlert } from '../services/email';

const STORAGE_KEY = 'vinci_inventory_v3';

const INITIAL_STATE = {
    stock: {
        'PC Neuf': 5,
        'PC Occasion': 5,
        Casque: 10,
        Souris: 20,
        Clavier: 10,
        Sacoche: 15,
        Chargeur: 20,
        Dock: 10,
        Iphone: 5,
        Xcover: 5
    },
    history: [],
    loans: [] // Array of { id, name, date }
};

export function useInventory() {
    const [data, setData] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return {
                    stock: { ...INITIAL_STATE.stock, ...parsed.stock },
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

            // Trigger Email Alert if Casque drops below 5 (Crossing the threshold)
            if (category === 'Casque' && prevCount >= 5 && newCount < 5 && delta < 0) {
                sendLowStockAlert('Casque', newCount);
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
                if (item === 'Casque' && currentQty >= 5 && newQty < 5) {
                    sendLowStockAlert('Casque', newQty);
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
                if (id === 'Casque' && currentStock >= 5 && newQty < 5) {
                    sendLowStockAlert('Casque', newQty);
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
        removeLoan
    };
}
