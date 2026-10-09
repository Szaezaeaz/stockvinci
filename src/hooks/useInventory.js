import { useState, useEffect, useRef, useCallback } from 'react';
import { sendLowStockAlert } from '../services/email';
import { getLowStockThreshold } from '../config/thresholds';
import { PHONE_CASE_INFO } from '../config/phoneAccessories';
import { fetchCloud, pushCloud, getPasscode, savePasscode, loadSyncMeta, saveSyncMeta } from '../services/cloudSync';

const STORAGE_KEY = 'vinci_inventory_v3';

const INITIAL_STATE = {
    stock: {
        '650 G11 Neuf': 5,
        '650 G11 Occasion': 5,
        '850 G8/G10 Occasion': 0,
        'X360 Neuf': 0,
        'X360 Occasion': 0,
        'Zbook Neuf': 0,
        'Zbook Occasion': 0,
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
        'Samsung A36': 0,
        'iPhone 17': 0,
        'Coque+Vitre iPhone 16e': 0,
        'Coque+Vitre iPhone 17': 0,
        'Coque+Vitre Samsung A36': 0,
        'Coque Samsung XCOVER 7': 0,
        'Vitre Samsung XCOVER 7': 0
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
    Xcover: 'Samsung XCOVER 7',
    '850 G8 Occasion': '850 G8/G10 Occasion'
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

function normalizeData(parsed) {
    return {
        stock: { ...INITIAL_STATE.stock, ...migrateLegacyStock(parsed.stock || {}) },
        history: parsed.history || [],
        loans: parsed.loans || []
    };
}

const SYNC_INTERVAL_MS = 60000;
const PUSH_DELAY_MS = 1500;

export function useInventory() {
    const [data, setData] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                return normalizeData(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse inventory data', e);
            }
        }
        return INITIAL_STATE;
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, [data]);

    // --- Synchronisation cloud -------------------------------------------
    // syncStatus : 'off' (cloud non configuré) | 'needs-code' | 'syncing' |
    //              'synced' | 'offline' | 'error'
    const [syncStatus, setSyncStatus] = useState(getPasscode() ? 'syncing' : 'needs-code');
    const [syncNotice, setSyncNotice] = useState('');
    const dataRef = useRef(data);
    const knownDataRef = useRef(data); // dernier état connu côté synchro (local initial ou cloud)
    const metaRef = useRef(loadSyncMeta());
    const busyRef = useRef(false);
    const rerunRef = useRef(false);
    const pushTimerRef = useRef(null);

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    const updateMeta = useCallback((patch) => {
        metaRef.current = { ...metaRef.current, ...patch };
        saveSyncMeta(metaRef.current);
    }, []);

    const adoptCloud = useCallback((cloud) => {
        const next = normalizeData(cloud.data);
        knownDataRef.current = next;
        dataRef.current = next;
        updateMeta({ rev: cloud.rev, dirty: false });
        setData(next);
    }, [updateMeta]);

    const sync = useCallback(async () => {
        if (!getPasscode()) {
            setSyncStatus('needs-code');
            return;
        }
        if (busyRef.current) {
            rerunRef.current = true;
            return;
        }
        busyRef.current = true;
        setSyncStatus('syncing');
        try {
            let result;
            if (metaRef.current.dirty) {
                const snapshot = dataRef.current;
                result = await pushCloud(snapshot, metaRef.current.rev);
                if (result.status === 200) {
                    // Si l'utilisateur a encore modifié pendant l'envoi, on garde "dirty".
                    updateMeta({ rev: result.body.rev, dirty: dataRef.current !== snapshot });
                    if (metaRef.current.dirty) rerunRef.current = true;
                    setSyncStatus('synced');
                    return;
                }
                if (result.status === 409) {
                    adoptCloud(result.body);
                    setSyncNotice("Un autre appareil a modifié le stock : vos dernières modifications ont été remplacées par la version à jour.");
                    setSyncStatus('synced');
                    return;
                }
            } else {
                result = await fetchCloud();
                if (result.status === 200) {
                    const cloud = result.body;
                    if (cloud.data == null) {
                        // Cloud vide : on y envoie l'état de cet appareil.
                        updateMeta({ dirty: true });
                        rerunRef.current = true;
                    } else if (cloud.rev !== metaRef.current.rev) {
                        adoptCloud(cloud);
                    }
                    setSyncStatus('synced');
                    return;
                }
            }
            if (result.status === 503) setSyncStatus('off');
            else if (result.status === 401) setSyncStatus('needs-code');
            else if (result.status === 0) setSyncStatus('offline');
            else setSyncStatus('error');
        } finally {
            busyRef.current = false;
            if (rerunRef.current) {
                rerunRef.current = false;
                sync();
            }
        }
    }, [adoptCloud, updateMeta]);

    // Toute modification locale (pas celles reprises du cloud) marque l'appareil
    // "dirty" et déclenche un envoi différé.
    useEffect(() => {
        if (data === knownDataRef.current) return;
        knownDataRef.current = data;
        updateMeta({ dirty: true });
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = setTimeout(sync, PUSH_DELAY_MS);
    }, [data, sync, updateMeta]);

    // Synchro au lancement, au retour sur l'appli / la connexion, puis toutes les minutes.
    useEffect(() => {
        const timeout = setTimeout(sync, 0);
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') sync();
        }, SYNC_INTERVAL_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible') sync();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('online', sync);
        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('online', sync);
        };
    }, [sync]);

    const submitPasscode = (code) => {
        savePasscode(code.trim());
        sync();
    };

    const dismissSyncNotice = () => setSyncNotice('');

    const addLoan = (name, pcType, phoneType, accessories = {
        mouse: true, headset: false, bag: true, backpack: false, screen: false, dock: false, keyboard: false,
        phoneCase: true, phoneScreen: true
    }) => {
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
                const threshold = getLowStockThreshold(item);
                if (threshold > 0 && currentQty >= threshold && newQty < threshold) {
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
            const canDeductBackpack = accessories.backpack ? processDeduction('Sac à Dos') : true;
            const canDeductScreen = accessories.screen ? processDeduction('Écran') : true;
            const canDeductDock = accessories.dock ? processDeduction('Dock') : true;
            const canDeductKeyboard = accessories.keyboard ? processDeduction('Clavier') : true;
            const canDeductPhone = phoneType ? processDeduction(phoneType) : true;

            // Coque/vitre du téléphone : un seul article si vendues ensemble
            // (iPhone 16e/17, Samsung A36), deux articles distincts sinon (Xcover).
            let canDeductPhoneCase = true;
            let canDeductPhoneScreen = true;
            if (phoneType) {
                const caseInfo = PHONE_CASE_INFO[phoneType];
                if (caseInfo?.bundled) {
                    canDeductPhoneCase = accessories.phoneCase ? processDeduction(caseInfo.comboItem) : true;
                } else if (caseInfo) {
                    canDeductPhoneCase = accessories.phoneCase ? processDeduction(caseInfo.caseItem) : true;
                    canDeductPhoneScreen = accessories.phoneScreen ? processDeduction(caseInfo.screenItem) : true;
                }
            }

            if (!canDeductPC || !canDeductMouse || !canDeductHeadset || !canDeductBag || !canDeductBackpack
                || !canDeductScreen || !canDeductDock || !canDeductKeyboard || !canDeductPhone
                || !canDeductPhoneCase || !canDeductPhoneScreen) {
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
                category: 'Prêt Matériel',
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
                const threshold = getLowStockThreshold(id);
                if (threshold > 0 && currentStock >= threshold && newQty < threshold) {
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

    const addStock = (items) => {
        setData(prev => {
            const newStock = { ...prev.stock };
            const addedItemsList = [];

            // items is Array of { id, count }
            for (const { id, count } of items) {
                if (count <= 0) continue;
                newStock[id] = (newStock[id] || 0) + count;
                const itemLabel = count > 1 ? `${id} (x${count})` : id;
                addedItemsList.push(itemLabel);
            }

            if (addedItemsList.length === 0) return prev;

            const historyEntry = {
                id: Date.now(),
                category: 'Ajout Matériel',
                delta: 1,
                recipient: null,
                details: addedItemsList,
                date: new Date()
            };

            return {
                ...prev,
                stock: newStock,
                history: [historyEntry, ...prev.history].slice(0, 50)
            };
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
        addLoan,
        addWithdrawal,
        addStock,
        removeLoan,
        returnLoan,
        quickReturnPC,
        syncStatus,
        syncNotice,
        submitPasscode,
        dismissSyncNotice,
        syncNow: sync
    };
}
