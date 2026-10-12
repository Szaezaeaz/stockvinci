import { useState, useEffect, useRef, useCallback } from 'react';
import { sendLowStockAlert } from '../services/email';
import { getLowStockThreshold } from '../config/thresholds';
import { PHONE_CASE_INFO } from '../config/phoneAccessories';
import { normalizeSerial } from '../utils/serial';
import { getLoanSerials } from '../utils/loans';
import { exactModelFromStockKey, kindOfModel, matchModelName, setLearnedAliases, stockKeyLabel, stockKeyOf } from '../utils/models';
import { applyUndoPatch, diffState } from '../utils/undo';
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
    // série : { serial, kind, model, exactModel, events: [{ date, action, person }] }.
    // model = ligne de stock qui compte l'appareil ("650 G11 Occasion") ;
    // exactModel = son modèle précis ("HP EliteBook 660 16 inch G11 Notebook PC").
    devices: {},
    // Modèles choisis à la main pour des QR codes non reconnus, retenus pour les
    // scans suivants (voir utils/models).
    modelAliases: {}
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

// Accessoires cochés par défaut quand on attribue du matériel.
const DEFAULT_LOAN_ACCESSORIES = {
    mouse: true, headset: false, bag: true, backpack: false, screen: false, dock: false, keyboard: false,
    phoneCase: true, phoneScreen: true
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

// Modèle exact d'une fiche créée avant qu'il soit enregistré : retrouvé d'après
// le nom lu dans le QR code, sinon d'après la ligne de stock quand elle ne
// correspond qu'à un seul modèle.
function withExactModel(device) {
    if (device.exactModel) return device;
    const exactModel = matchModelName(device.modelName, device.productId).model || exactModelFromStockKey(device.model);
    return exactModel ? { ...device, exactModel } : device;
}

// Retire un appareil des attributions qui le mentionnent : son n° de série et
// l'article correspondant. Une attribution qui n'a plus rien disparaît.
function detachFromLoans(loans, serial, stockKey) {
    if (!loans.some(loan => getLoanSerials(loan).includes(serial))) return loans;
    const next = [];
    for (const loan of loans) {
        const serials = getLoanSerials(loan);
        if (!serials.includes(serial)) {
            next.push(loan);
            continue;
        }
        const items = [...(loan.items || [])];
        const index = items.indexOf(stockKey);
        if (index !== -1) items.splice(index, 1);
        const remaining = serials.filter(other => other !== serial);
        if (items.length > 0 || remaining.length > 0) next.push({ ...loan, items, serials: remaining });
    }
    return next;
}

function normalizeData(parsed) {
    setLearnedAliases(parsed.modelAliases);
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
                withExactModel({ status: 'stock', holder: null, ...device })
            ])
        ),
        modelAliases: parsed.modelAliases || {}
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

// --- Rollback : pour chacune des 10 dernières actions, ce qu'elle a changé ------
// (les anciennes valeurs, voir utils/undo). Stocké sur l'appareil seulement
// (jamais envoyé dans le cloud) ; vidé quand l'appli reprend des données venues
// d'un autre appareil.
const UNDO_KEY = 'vinci_undo_stack';
const UNDO_LIMIT = 10;
const UNDO_MAX_CHARS = 1500000;

function loadUndoStack() {
    try {
        const raw = JSON.parse(localStorage.getItem(UNDO_KEY));
        return Array.isArray(raw) ? raw.slice(0, UNDO_LIMIT) : [];
    } catch {
        return [];
    }
}

function saveUndoStack(stack) {
    let list = stack;
    for (;;) {
        try {
            const text = JSON.stringify(list);
            if (text.length > UNDO_MAX_CHARS && list.length > 1) {
                list = list.slice(0, -1); // trop volumineux : on abandonne les plus anciennes
                continue;
            }
            localStorage.setItem(UNDO_KEY, text);
            return;
        } catch {
            if (list.length <= 1) return;
            list = list.slice(0, -1);
        }
    }
}

// Nom d'une action pour la liste du rollback, d'après la ligne d'historique qu'elle a créée.
function describeChange(previous, current) {
    const entry = current.history?.[0];
    if (entry && entry.id !== previous.history?.[0]?.id) {
        return `${entry.category}${entry.recipient ? ` · ${entry.recipient}` : ''}`;
    }
    return 'Modification';
}

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

    // --- Synchronisation cloud -------------------------------------------
    // syncStatus : 'off' (cloud non configuré) | 'needs-code' | 'syncing' |
    //              'synced' | 'offline' | 'error'
    const [syncStatus, setSyncStatus] = useState(getPasscode() ? 'syncing' : 'needs-code');
    const [syncNotice, setSyncNotice] = useState('');

    // Enregistrement sur l'appareil. Si le stockage est plein, on libère la place
    // du rollback (secondaire) pour ne jamais perdre l'inventaire lui-même.
    useEffect(() => {
        const text = JSON.stringify(data);
        try {
            localStorage.setItem(STORAGE_KEY, text);
        } catch {
            try {
                localStorage.removeItem(UNDO_KEY);
                localStorage.setItem(STORAGE_KEY, text);
            } catch (e) {
                console.error('Failed to save inventory data', e);
                setSyncNotice("Le stockage de cet appareil est plein : les dernières modifications ne sont pas enregistrées ici. Vérifie que la synchronisation indique « Sauvegardé ».");
            }
        }
    }, [data]);
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

    // Rollback : pile des états précédents (la plus récente d'abord).
    const [undoStack, setUndoStack] = useState(loadUndoStack);
    const undoStackRef = useRef(undoStack);
    const skipUndoRef = useRef(false); // vrai pendant un rollback : il ne s'empile pas lui-même
    const pendingLabelRef = useRef('');

    const updateUndoStack = useCallback((next) => {
        undoStackRef.current = next;
        saveUndoStack(next);
        setUndoStack(next);
    }, []);

    const recordUndo = useCallback((previous, current) => {
        const label = pendingLabelRef.current || describeChange(previous, current);
        pendingLabelRef.current = '';
        const patch = diffState(previous, current);
        if (Object.keys(patch).length === 0) return;
        const entry = { id: Date.now(), label, at: new Date().toISOString(), patch };
        updateUndoStack([entry, ...undoStackRef.current].slice(0, UNDO_LIMIT));
    }, [updateUndoStack]);

    useEffect(() => {
        dataRef.current = data;
        setLearnedAliases(data.modelAliases);
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
        updateUndoStack([]); // les données viennent d'un autre appareil : on ne peut plus revenir avant
        setData(next);
    }, [updateMeta, updateUndoStack]);

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
                result = await fetchCloud(metaRef.current.rev);
                if (result.status === 200) {
                    const cloud = result.body;
                    if (cloud.unchanged) {
                        // Rien de neuf dans le cloud : l'inventaire n'a pas été renvoyé.
                    } else if (cloud.data == null) {
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
        const previous = knownDataRef.current;
        knownDataRef.current = data;
        if (skipUndoRef.current) {
            skipUndoRef.current = false;
        } else {
            recordUndo(previous, data);
        }
        updateMeta({ dirty: true });
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = setTimeout(sync, PUSH_DELAY_MS);
    }, [data, sync, updateMeta, recordUndo]);

    // Revient à l'état d'avant l'action n° index de la liste (0 = la plus récente) ;
    // cette action et celles qui l'ont suivie sont annulées. Le résultat est envoyé
    // au cloud comme n'importe quelle autre modification.
    const rollbackTo = (index) => {
        const stack = undoStackRef.current;
        if (!stack[index]) return;
        // On défait les actions une à une, de la plus récente jusqu'à celle choisie.
        // (entry.snapshot : ancien format, copie complète de l'état d'avant l'action.)
        let restored = dataRef.current;
        for (let i = 0; i <= index; i++) {
            restored = stack[i].snapshot ? normalizeData(stack[i].snapshot) : applyUndoPatch(restored, stack[i].patch);
        }
        skipUndoRef.current = true;
        updateUndoStack(stack.slice(index + 1));
        setData(restored);
    };

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

    // pcs / phones : [{ model, serial }] — chaque appareil peut porter son n° de série
    // (vide pour du stock ancien non suivi). Les appareils suivis passent "attribués"
    // à la personne.
    const addLoan = (name, { pcs = [], phones = [], accessories = DEFAULT_LOAN_ACCESSORIES } = {}) => {
        setData(prev => {
            const stockUpdates = {};
            // On crée UNE seule entrée d'historique pour toute l'attribution.
            const loanedItems = []; // noms de stock (utilisés pour le retour en stock)
            const details = []; // même liste avec les n° de série, pour l'historique
            const trackedSerials = [];
            const newDate = new Date();

            const labelWithSerial = (item, rawSerial) => {
                const serial = normalizeSerial(rawSerial);
                if (!serial || trackedSerials.includes(serial)) return stockKeyLabel(item);
                trackedSerials.push(serial);
                return `${stockKeyLabel(item)} (S/N ${serial})`;
            };

            // Helper to process deduction
            const processDeduction = (item, label = item) => {
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
                details.push(label);
                return true;
            };

            let allDeducted = true;
            const deduct = (item, label) => {
                if (!processDeduction(item, label)) allDeducted = false;
            };

            // PC (un ou plusieurs)
            pcs.forEach(pc => deduct(pc.model, labelWithSerial(pc.model, pc.serial)));

            // Accessoires
            if (accessories.mouse) deduct('Souris');
            if (accessories.headset) deduct('Casque');
            if (accessories.bag) deduct('Sacoche');
            if (accessories.backpack) deduct('Sac à Dos');
            if (accessories.screen) deduct('Écran');
            if (accessories.dock) deduct('Dock');
            if (accessories.keyboard) deduct('Clavier');

            // Téléphones, puis coque/vitre de chacun : un seul article si vendues ensemble
            // (iPhone 16e/17, Samsung A36), deux articles distincts sinon (Xcover).
            phones.forEach(phone => {
                deduct(phone.model, labelWithSerial(phone.model, phone.serial));
                const caseInfo = PHONE_CASE_INFO[phone.model];
                if (caseInfo?.bundled) {
                    if (accessories.phoneCase) deduct(caseInfo.comboItem);
                } else if (caseInfo) {
                    if (accessories.phoneCase) deduct(caseInfo.caseItem);
                    if (accessories.phoneScreen) deduct(caseInfo.screenItem);
                }
            });

            if (!allDeducted) {
                alert("Stock insuffisant pour un ou plusieurs articles !");
                return prev;
            }

            // Apply updates
            const newStock = { ...prev.stock };
            for (const [item, delta] of Object.entries(stockUpdates)) {
                newStock[item] = (newStock[item] || 0) + delta;
            }

            const loanPackageEntry = {
                id: Date.now(),
                category: 'Attribution matériel',
                delta: -1, // Logical decrement (1 package out)
                recipient: name,
                details,
                date: newDate
            };

            const newLoan = {
                id: Date.now(),
                name,
                date: newDate,
                items: loanedItems,
                serials: trackedSerials
            };

            // Les appareils précis passent "attribués" à la personne.
            const devices = { ...(prev.devices || {}) };
            trackedSerials.forEach(serial => {
                if (!devices[serial]) return;
                devices[serial] = {
                    ...devices[serial],
                    status: 'assigned',
                    holder: name,
                    events: [{ date: newDate, action: 'Attribution', person: name }, ...(devices[serial].events || [])].slice(0, 20)
                };
            });

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

            // Les appareils attribués (PC, téléphone) retournent "en stock".
            const devices = { ...(prev.devices || {}) };
            const returnedDate = new Date();
            getLoanSerials(loan).forEach(serial => {
                if (!devices[serial]) return;
                devices[serial] = {
                    ...devices[serial],
                    status: 'stock',
                    holder: null,
                    events: [{ date: returnedDate, action: 'Retour', person: loan.name || loan.recipient }, ...(devices[serial].events || [])].slice(0, 20)
                };
            });

            // History Log
            const historyEntry = {
                id: Date.now(),
                category: 'Retour matériel',
                delta: 1,
                recipient: loan.recipient,
                details: loan.items.map(stockKeyLabel),
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
    // pcModel / phoneModel : lignes de stock ; pcExactModel / phoneExactModel : modèles précis.
    const returnFromEmployee = (name, { pcModel, pcExactModel, pcSerial, phoneModel, phoneExactModel, phoneSerial, phoneCase, accessories = {} }) => {
        setData(prev => {
            const stockUpdates = {};
            const details = [];
            const devices = { ...(prev.devices || {}) };
            let loans = prev.loans;
            const date = new Date();

            const add = (item) => { stockUpdates[item] = (stockUpdates[item] || 0) + 1; };
            // Appareil rendu : il rejoint la ligne de stock `model`. Avec un n° de série,
            // sa fiche passe "en stock" et il quitte l'attribution qui le mentionnait.
            const giveBack = (rawSerial, kind, model, exactModel) => {
                const serial = normalizeSerial(rawSerial);
                const known = serial ? devices[serial] : null;
                if (known?.status === 'stock') {
                    // déjà compté dans le stock : il change seulement de ligne si besoin
                    stockUpdates[known.model] = (stockUpdates[known.model] || 0) - 1;
                }
                add(model);
                if (!serial) return stockKeyLabel(model);
                if (known?.status === 'assigned') loans = detachFromLoans(loans, serial, known.model);
                const resolved = exactModel || known?.exactModel || exactModelFromStockKey(model);
                devices[serial] = {
                    ...known,
                    serial,
                    kind,
                    model,
                    ...(resolved ? { exactModel: resolved } : {}),
                    status: 'stock',
                    holder: null,
                    events: [{ date, action: 'Retour', person: name }, ...(known?.events || [])].slice(0, 20)
                };
                return `${stockKeyLabel(model)} (S/N ${serial})`;
            };

            if (pcModel) {
                details.push(giveBack(pcSerial, 'pc', pcModel, pcExactModel));
            }
            if (phoneModel) {
                details.push(giveBack(phoneSerial, 'phone', phoneModel, phoneExactModel));
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
                loans,
                history: [historyEntry, ...prev.history].slice(0, 50)
            };
        });
    };

    // Réception de matériel scanné : chaque n° de série devient une fiche
    // d'appareil "en stock" et le stock du modèle augmente d'autant. Les n° de
    // série déjà connus sont ignorés.
    // entries : [{ serial, model, exactModel?, modelName?, productId?, learnKey? }] —
    // chaque appareil porte sa ligne de stock (model) et son modèle précis
    // (exactModel), reconnu depuis le QR code ou choisi à la main. learnKey : clé
    // sous laquelle retenir ce choix pour les prochains scans (QR non reconnu).
    const receiveDevices = (entries) => {
        setData(prev => {
            const devices = { ...(prev.devices || {}) };
            const stock = { ...prev.stock };
            let modelAliases = prev.modelAliases || {};
            const date = new Date();
            const details = [];

            for (const entry of entries) {
                const serial = normalizeSerial(entry.serial);
                if (!serial || devices[serial]) continue;
                const exactModel = entry.exactModel || exactModelFromStockKey(entry.model);
                if (entry.learnKey && exactModel && modelAliases[entry.learnKey] !== exactModel) {
                    modelAliases = { ...modelAliases, [entry.learnKey]: exactModel };
                }
                devices[serial] = {
                    serial,
                    kind: kindOfModel(exactModel || entry.model),
                    model: entry.model,
                    ...(exactModel ? { exactModel } : {}),
                    modelName: entry.modelName || '',
                    productId: entry.productId || '',
                    status: 'stock',
                    holder: null,
                    events: [{ date, action: 'Réception', person: null }]
                };
                stock[entry.model] = (stock[entry.model] || 0) + 1;
                details.push(`${stockKeyLabel(entry.model)} (S/N ${serial})`);
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
                modelAliases,
                history: [historyEntry, ...prev.history].slice(0, 50)
            };
        });
    };

    // Import d'un inventaire existant (voir utils/inventoryImport).
    // rows : [{ serial, model (modèle précis), kind, person }]. Un appareil avec une
    // personne lui est attribué (une seule attribution, déjà remise, par personne) ;
    // sans personne, il entre en stock. Tout le matériel importé a déjà servi : les
    // PC sont rangés en Occasion. Les n° de série déjà connus sont ignorés.
    const importInventory = (rows) => {
        setData(prev => {
            const devices = { ...(prev.devices || {}) };
            const stock = { ...prev.stock };
            const date = new Date();
            const byPerson = new Map();
            let inStock = 0;

            for (const row of rows) {
                const serial = normalizeSerial(row.serial);
                if (!serial || !row.model || devices[serial]) continue;
                const person = String(row.person || '').trim() || null;
                const model = stockKeyOf(row.model, 'Occasion');
                devices[serial] = {
                    serial,
                    kind: row.kind || kindOfModel(row.model),
                    model,
                    exactModel: row.model,
                    status: person ? 'assigned' : 'stock',
                    holder: person,
                    events: [{ date, action: 'Import', person }]
                };
                if (person) {
                    const key = person.toLowerCase();
                    if (!byPerson.has(key)) byPerson.set(key, { name: person, items: [], serials: [] });
                    byPerson.get(key).items.push(model);
                    byPerson.get(key).serials.push(serial);
                } else {
                    stock[model] = (stock[model] || 0) + 1;
                    inStock++;
                }
            }

            const assigned = [...byPerson.values()].reduce((sum, person) => sum + person.serials.length, 0);
            if (assigned + inStock === 0) return prev;

            // Identifiants distincts de ceux des attributions créées à la main (Date.now()).
            const baseId = Date.now() * 1000;
            const loans = [...byPerson.values()].map((person, index) => ({
                id: baseId + index,
                name: person.name,
                date,
                items: person.items,
                serials: person.serials,
                pickedUpAt: date,
                imported: true
            }));

            const plural = (count, word) => `${count} ${word}${count > 1 ? 's' : ''}`;
            const historyEntry = {
                id: Date.now(),
                category: 'Import inventaire',
                delta: 1,
                recipient: null,
                details: [
                    `${plural(assigned + inStock, 'appareil')} importé${assigned + inStock > 1 ? 's' : ''}`,
                    `${assigned} attribué${assigned > 1 ? 's' : ''} à ${plural(loans.length, 'personne')}`,
                    `${inStock} en stock`
                ],
                date
            };

            return {
                ...prev,
                stock,
                devices,
                loans: [...prev.loans, ...loans],
                history: [historyEntry, ...prev.history].slice(0, 50)
            };
        });
    };

    // Supprime la fiche d'un appareil. S'il était en stock, le stock de son modèle
    // diminue d'une unité ; s'il était attribué, le stock ne change pas (déjà sorti)
    // et il disparaît de l'attribution de la personne.
    const deleteDevice = (serial) => {
        setData(prev => {
            const device = prev.devices?.[serial];
            if (!device) return prev;

            const devices = { ...prev.devices };
            delete devices[serial];

            const stock = { ...prev.stock };
            if (device.status === 'stock') {
                stock[device.model] = Math.max(0, (stock[device.model] || 0) - 1);
            }

            const historyEntry = {
                id: Date.now(),
                category: 'Suppression appareil',
                delta: -1,
                recipient: device.status === 'assigned' ? device.holder : null,
                details: [`${stockKeyLabel(device.model)} (S/N ${serial})`],
                date: new Date()
            };

            return {
                ...prev,
                stock,
                devices,
                loans: detachFromLoans(prev.loans, serial, device.model),
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
                details: [`${stockKeyLabel(model)} : ${untracked} unité${untracked > 1 ? 's' : ''} sans n° de série retirée${untracked > 1 ? 's' : ''}`],
                date: new Date()
            };

            return {
                ...prev,
                stock: { ...prev.stock, [model]: tracked },
                history: [historyEntry, ...prev.history].slice(0, 50)
            };
        });
    };

    // Le matériel a été remis à la personne : la fiche quitte "À remettre" mais
    // reste dans "Matériel attribué" (avec sa date de remise) jusqu'à son retour.
    const handOverLoan = (id) => {
        const loan = dataRef.current.loans.find(l => l.id === id);
        pendingLabelRef.current = `Matériel remis${loan ? ` · ${loan.name || loan.recipient}` : ''}`;
        setData(prev => ({
            ...prev,
            loans: prev.loans.map(loan => (loan.id === id && !loan.pickedUpAt ? { ...loan, pickedUpAt: new Date() } : loan))
        }));
    };

    // Un appareil attribué revient en stock, seul (le reste de l'attribution de la
    // personne ne change pas).
    const returnAssignedDevice = (serial) => {
        setData(prev => {
            const device = prev.devices?.[serial];
            if (!device || device.status !== 'assigned') return prev;
            const date = new Date();
            return {
                ...prev,
                stock: { ...prev.stock, [device.model]: (prev.stock[device.model] || 0) + 1 },
                devices: {
                    ...prev.devices,
                    [serial]: {
                        ...device,
                        status: 'stock',
                        holder: null,
                        events: [{ date, action: 'Retour', person: device.holder }, ...(device.events || [])].slice(0, 20)
                    }
                },
                loans: detachFromLoans(prev.loans, serial, device.model),
                history: [{
                    id: Date.now(),
                    category: 'Retour matériel',
                    delta: 1,
                    recipient: device.holder,
                    details: [`${stockKeyLabel(device.model)} (S/N ${serial})`],
                    date
                }, ...prev.history].slice(0, 50)
            };
        });
    };

    return {
        stock: data.stock,
        history: data.history,
        loans: data.loans,
        devices: data.devices,
        returnFromEmployee,
        receiveDevices,
        importInventory,
        removeUntrackedStock,
        deleteDevice,
        addLoan,
        addWithdrawal,
        addStock,
        handOverLoan,
        undoStack,
        rollbackTo,
        returnAssignedDevice,
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
