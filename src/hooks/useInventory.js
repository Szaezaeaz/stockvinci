import { useState, useEffect, useRef, useCallback } from 'react';
import { sendLowStockAlert } from '../services/email';
import { getLowStockThreshold } from '../config/thresholds';
import { PHONE_CASE_INFO, PHONE_MODEL_OPTIONS } from '../config/phoneAccessories';
import { normalizeSerial } from '../utils/serial';
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
        'Chargeur USB-C': 20,
        'Ancien chargeur': 0,
        'Chargeur téléphone': 0,
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
    loans: [], // Array of { id, name, date }
    // Registre des numéros de série saisis (PC / téléphones), indexé par n° de
    // série : { serial, kind, model, events: [{ date, action, person }] }.
    devices: {}
};

// Maps legacy generic category names (pre-model-tracking) to their closest
// specific replacement, so existing on-device stock counts aren't lost when
// this update lands on a tablet that already has real inventory data.
const LEGACY_KEY_MIGRATIONS = {
    'PC Neuf': '650 G11 Neuf',
    'PC Occasion': '650 G11 Occasion',
    Iphone: 'iPhone 16e',
    Xcover: 'Samsung XCOVER 7',
    '850 G8 Occasion': '850 G8/G10 Occasion',
    Chargeur: 'Chargeur USB-C',
    'Anciens chargeurs': 'Ancien chargeur'
};

// Accessoires récupérables avec un collaborateur : case à cocher -> article de stock.
const RETURN_ACCESSORY_ITEMS = {
    mouse: 'Souris',
    charger: 'Chargeur USB-C',
    headset: 'Casque',
    bag: 'Sacoche',
    backpack: 'Sac à Dos',
    screen: 'Écran',
    dock: 'Dock',
    keyboard: 'Clavier'
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

// Renomme un article d'un prêt (ex. "Chargeur (x2)" -> "Chargeur USB-C (x2)").
function migrateLoanItem(itemStr) {
    const match = itemStr.match(/^(.+?)( \(x\d+\))?$/);
    const base = match ? match[1] : itemStr;
    return (LEGACY_KEY_MIGRATIONS[base] || base) + (match?.[2] || '');
}

function normalizeData(parsed) {
    return {
        stock: { ...INITIAL_STATE.stock, ...migrateLegacyStock(parsed.stock || {}) },
        history: parsed.history || [],
        loans: (parsed.loans || []).map(loan => ({
            ...loan,
            items: Array.isArray(loan.items) ? loan.items.map(migrateLoanItem) : loan.items
        })),
        // Fiches créées avant l'ajout du statut : elles viennent d'un retour, donc en stock.
        devices: Object.fromEntries(
            Object.entries(parsed.devices || {}).map(([serial, device]) => [
                serial,
                { status: 'stock', holder: null, ...device }
            ])
        )
    };
}

function summarize(data) {
    return {
        units: Object.values(data.stock || {}).reduce((sum, n) => sum + (n || 0), 0),
        loans: (data.loans || []).length,
        history: (data.history || []).length
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
    // Premier lancement de la synchro sur cet appareil alors que le cloud contient
    // déjà des données : on demande lesquelles garder au lieu de trancher seuls.
    const [syncChoice, setSyncChoice] = useState(null); // { cloud, local } (résumés)
    const pendingCloudRef = useRef(null);

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

    const askWhichToKeep = useCallback((cloud) => {
        pendingCloudRef.current = cloud;
        setSyncChoice({ cloud: summarize(cloud.data), local: summarize(dataRef.current) });
        setSyncStatus('needs-choice');
    }, []);

    const sync = useCallback(async () => {
        if (!getPasscode()) {
            setSyncStatus('needs-code');
            return;
        }
        if (pendingCloudRef.current) {
            setSyncStatus('needs-choice');
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
                if (result.status === 409 && metaRef.current.rev === 0 && result.body.data) {
                    askWhichToKeep(result.body);
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
                        if (metaRef.current.rev === 0) {
                            askWhichToKeep(cloud);
                            return;
                        }
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
    }, [adoptCloud, askWhichToKeep, updateMeta]);

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

    // choice : 'cloud' (cet appareil reprend le cloud) ou 'local' (le cloud est
    // remplacé par les données de cet appareil).
    const resolveSyncChoice = (choice) => {
        const cloud = pendingCloudRef.current;
        if (!cloud) return;
        pendingCloudRef.current = null;
        setSyncChoice(null);
        if (choice === 'cloud') {
            adoptCloud(cloud);
            setSyncStatus('synced');
        } else {
            updateMeta({ rev: cloud.rev, dirty: true });
            sync();
        }
    };

    const addLoan = (name, pcType, phoneType, accessories = {
        mouse: true, headset: false, bag: true, backpack: false, screen: false, dock: false, keyboard: false,
        phoneCase: true, phoneScreen: true
    }, pcSerial = '') => {
        setData(prev => {
            const stockUpdates = {};
            // We won't push individual history updates anymore.
            // We will push ONE composite "Loan Package" update.

            const loanedItems = [];
            const newDate = new Date();
            const serial = normalizeSerial(pcSerial);

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
                category: 'Matériel à récupérer',
                delta: -1, // Logical decrement (1 package out)
                recipient: name,
                details: loanedItems.map(item => (item === pcType && serial ? `${item} (S/N ${serial})` : item)),
                date: newDate
            };

            const newLoan = {
                id: Date.now(),
                name,
                date: newDate,
                items: loanedItems,
                pcSerial: serial
            };

            // Le PC précis passe "attribué" à la personne.
            const devices = { ...(prev.devices || {}) };
            if (serial && devices[serial]) {
                devices[serial] = {
                    ...devices[serial],
                    status: 'assigned',
                    holder: name,
                    events: [{ date: newDate, action: 'Attribution', person: name }, ...(devices[serial].events || [])].slice(0, 20)
                };
            }

            return {
                ...prev,
                stock: newStock,
                devices,
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
                // Entrées créées avant le découpage / renommage des chargeurs : on les remet dans la bonne catégorie.
                id = LEGACY_KEY_MIGRATIONS[id] || id;
                stockUpdates[id] = (stockUpdates[id] || 0) + count;
            });

            // Update Stock
            const newStock = { ...prev.stock };
            for (const [id, count] of Object.entries(stockUpdates)) {
                newStock[id] = (newStock[id] || 0) + count;
            }

            // Le PC attribué retourne "en stock".
            const devices = { ...(prev.devices || {}) };
            const returnedDate = new Date();
            if (loan.pcSerial && devices[loan.pcSerial]) {
                devices[loan.pcSerial] = {
                    ...devices[loan.pcSerial],
                    status: 'stock',
                    holder: null,
                    events: [{ date: returnedDate, action: 'Retour', person: loan.name || loan.recipient }, ...(devices[loan.pcSerial].events || [])].slice(0, 20)
                };
            }

            // History Log
            const historyEntry = {
                id: Date.now(),
                category: 'Retour matériel',
                delta: 1,
                recipient: loan.recipient,
                details: loan.items,
                date: returnedDate
            };

            return {
                ...prev,
                stock: newStock,
                devices,
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
            if (accessories.charger) { stockUpdates['Chargeur USB-C'] = 1; returnedItemsLog.push('Chargeur USB-C'); }
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

    // Retour d'un collaborateur (départ CDI/CDD...) : le PC rejoint le stock
    // Occasion de son modèle, le téléphone son stock, plus les accessoires.
    // Les numéros de série saisis alimentent le registre `devices`.
    const returnFromEmployee = (name, { pcModel, pcSerial, phoneModel, phoneSerial, phoneCase, accessories = {} }) => {
        setData(prev => {
            const stockUpdates = {};
            const details = [];
            const devices = { ...(prev.devices || {}) };
            const date = new Date();

            const add = (item) => { stockUpdates[item] = (stockUpdates[item] || 0) + 1; };
            const track = (rawSerial, kind, model) => {
                const serial = normalizeSerial(rawSerial);
                if (!serial) return '';
                const events = [{ date, action: 'Retour', person: name }, ...(devices[serial]?.events || [])].slice(0, 20);
                devices[serial] = { serial, kind, model, status: 'stock', holder: null, events };
                return ` (S/N ${serial})`;
            };

            if (pcModel) {
                add(pcModel);
                details.push(pcModel + track(pcSerial, 'pc', pcModel));
            }
            if (phoneModel) {
                add(phoneModel);
                details.push(phoneModel + track(phoneSerial, 'phone', phoneModel));
                const caseInfo = PHONE_CASE_INFO[phoneModel];
                if (phoneCase && caseInfo) {
                    const caseItems = caseInfo.bundled ? [caseInfo.comboItem] : [caseInfo.caseItem, caseInfo.screenItem];
                    caseItems.forEach(item => { add(item); details.push(item); });
                }
            }
            for (const [flag, item] of Object.entries(RETURN_ACCESSORY_ITEMS)) {
                if (accessories[flag]) { add(item); details.push(item); }
            }

            if (details.length === 0) return prev;

            const newStock = { ...prev.stock };
            for (const [item, count] of Object.entries(stockUpdates)) {
                newStock[item] = (newStock[item] || 0) + count;
            }

            const historyEntry = {
                id: Date.now(),
                category: 'Retour collaborateur',
                delta: 1,
                recipient: name,
                details,
                date
            };

            return {
                ...prev,
                stock: newStock,
                devices,
                history: [historyEntry, ...prev.history].slice(0, 50)
            };
        });
    };

    // Réception de matériel scanné : chaque n° de série devient une fiche
    // d'appareil "en stock" et le stock du modèle augmente d'autant. Les n° de
    // série déjà connus sont ignorés.
    // entries : [{ serial, model, modelName?, productId? }] — chaque appareil
    // porte son propre modèle (reconnu depuis le QR code, ou choisi à la main).
    const receiveDevices = (entries) => {
        setData(prev => {
            const devices = { ...(prev.devices || {}) };
            const stock = { ...prev.stock };
            const date = new Date();
            const details = [];

            for (const entry of entries) {
                const serial = normalizeSerial(entry.serial);
                if (!serial || devices[serial]) continue;
                devices[serial] = {
                    serial,
                    kind: PHONE_MODEL_OPTIONS.includes(entry.model) ? 'phone' : 'pc',
                    model: entry.model,
                    modelName: entry.modelName || '',
                    productId: entry.productId || '',
                    status: 'stock',
                    holder: null,
                    events: [{ date, action: 'Réception', person: null }]
                };
                stock[entry.model] = (stock[entry.model] || 0) + 1;
                details.push(`${entry.model} (S/N ${serial})`);
            }

            if (details.length === 0) return prev;

            const historyEntry = {
                id: Date.now(),
                category: 'Ajout Matériel',
                delta: 1,
                recipient: null,
                details,
                date
            };

            return {
                ...prev,
                stock,
                devices,
                history: [historyEntry, ...prev.history].slice(0, 50)
            };
        });
    };

    // Retire du stock les unités d'un modèle qui n'ont pas de fiche (n° de série) :
    // le stock du modèle devient égal au nombre d'appareils "en stock" scannés.
    const removeUntrackedStock = (model) => {
        setData(prev => {
            const tracked = Object.values(prev.devices || {})
                .filter(device => device.model === model && device.status === 'stock').length;
            const current = prev.stock[model] || 0;
            const untracked = current - tracked;
            if (untracked <= 0) return prev;

            const historyEntry = {
                id: Date.now(),
                category: 'Ajustement stock',
                delta: -1,
                recipient: null,
                details: [`${model} : ${untracked} unité${untracked > 1 ? 's' : ''} sans n° de série retirée${untracked > 1 ? 's' : ''}`],
                date: new Date()
            };

            return {
                ...prev,
                stock: { ...prev.stock, [model]: tracked },
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
        devices: data.devices,
        returnFromEmployee,
        receiveDevices,
        removeUntrackedStock,
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
        syncChoice,
        resolveSyncChoice,
        syncNow: sync
    };
}
