// Catalogue des modèles du parc, avec leur nom exact (celui de l'inventaire).
//
// kind  : 'pc' ou 'phone'.
// group : titre du groupe dans les listes de choix.
// line  : ligne de stock de l'accueil qui compte ce modèle. Dans l'appli, un
//         modèle qui a une ligne porte le nom de cette ligne (un ZBook Fury 16
//         G11 est un "Zbook") ; son nom exact reste enregistré sur l'appareil.
//           - PC : la famille ('660 G11', '850 G8/G10', 'X360', 'Zbook'), le
//             stock étant tenu en "<famille> Neuf" / "<famille> Occasion" ;
//           - téléphone : le nom de la ligne ('iPhone 16e', ...).
//         Sans `line`, le modèle a sa propre ligne de stock, qui n'apparaît pas
//         sur l'accueil (il reste visible par le scan, la recherche et l'onglet
//         Attribué).
// L'ordre est celui de la fréquence dans le parc : les plus courants d'abord.
export const MODEL_CATALOG = [
    // --- PC ---------------------------------------------------------------
    { name: 'HP EliteBook 660 16 inch G11 Notebook PC', kind: 'pc', group: 'PC', line: '660 G11' },
    { name: 'HP EliteBook 650 15.6 inch G10 Notebook PC', kind: 'pc', group: 'PC', line: '850 G8/G10' },
    { name: 'HP EliteBook 6 G1i 16 inch Notebook AI PC', kind: 'pc', group: 'PC' },
    { name: 'HP EliteBook 850 G8 Notebook PC', kind: 'pc', group: 'PC', line: '850 G8/G10' },
    { name: 'HP ZBook Fury 16 G11 Mobile Workstation PC', kind: 'pc', group: 'PC', line: 'Zbook' },
    { name: 'HP EliteBook 640 14 inch G11 Notebook PC', kind: 'pc', group: 'PC' },
    { name: 'HP ZBook Fury 16 G10 Mobile Workstation PC', kind: 'pc', group: 'PC', line: 'Zbook' },
    { name: 'HP EliteBook 850 G7 Notebook PC', kind: 'pc', group: 'PC' },
    { name: 'HP Elite x360 830 13 inch G11 2-in-1 Notebook PC', kind: 'pc', group: 'PC', line: 'X360' },
    { name: 'HP EliteBook 6 G1i 14 inch Notebook AI PC', kind: 'pc', group: 'PC' },
    { name: 'HP EliteBook 8 Flip G1i 13 inch Notebook AI PC', kind: 'pc', group: 'PC' },
    { name: 'HP EliteBook 640 14 inch G10 Notebook PC', kind: 'pc', group: 'PC' },
    { name: 'HP Elite x360 830 13 inch G10 2-in-1 Notebook PC', kind: 'pc', group: 'PC', line: 'X360' },
    { name: 'HP ZBook Fury 17.3 inch G8 Mobile Workstation PC', kind: 'pc', group: 'PC', line: 'Zbook' },
    { name: 'HP Dragonfly 13.5 inch G4 Notebook PC', kind: 'pc', group: 'PC' },
    { name: 'HP EliteBook 840 G8 Notebook PC', kind: 'pc', group: 'PC' },
    { name: 'HP EliteBook 850 G6', kind: 'pc', group: 'PC' },
    { name: 'HP EliteBook x360 830 G8 Notebook PC', kind: 'pc', group: 'PC', line: 'X360' },
    { name: 'HP ZBook Fury 17 G7 Mobile Workstation', kind: 'pc', group: 'PC', line: 'Zbook' },
    { name: 'HP Elite Dragonfly 13.5 inch G3 Notebook PC', kind: 'pc', group: 'PC' },
    { name: 'HP EliteBook 840 G7 Notebook PC', kind: 'pc', group: 'PC' },
    { name: 'HP EliteBook x360 830 G6', kind: 'pc', group: 'PC', line: 'X360' },
    { name: 'HP EliteOne 800 G4 23.8-in Non-Touch AiO', kind: 'pc', group: 'PC' },
    { name: 'HP ZBook 17 G6', kind: 'pc', group: 'PC', line: 'Zbook' },
    { name: 'HP ZBook Fury 15 G7 Mobile Workstation', kind: 'pc', group: 'PC', line: 'Zbook' },

    // --- iPhone -----------------------------------------------------------
    { name: 'iPhone 16e', kind: 'phone', group: 'iPhone', line: 'iPhone 16e' },
    { name: 'iPhone SE (3rd generation)', kind: 'phone', group: 'iPhone' },
    { name: 'iPhone 13', kind: 'phone', group: 'iPhone' },
    { name: 'iPhone 16 Pro', kind: 'phone', group: 'iPhone' },
    { name: 'iPhone 17 Pro', kind: 'phone', group: 'iPhone' },
    { name: 'iPhone 16', kind: 'phone', group: 'iPhone' },
    { name: 'iPhone 17', kind: 'phone', group: 'iPhone', line: 'iPhone 17' },
    { name: 'iPhone SE (2nd generation)', kind: 'phone', group: 'iPhone' },

    // --- Android ----------------------------------------------------------
    { name: 'Samsung Galaxy XCover 7', kind: 'phone', group: 'Android', line: 'Samsung XCOVER 7' },
    { name: 'Samsung Galaxy XCover 5', kind: 'phone', group: 'Android' },
    { name: 'Samsung Galaxy A33 5G', kind: 'phone', group: 'Android' },
    { name: 'Samsung Galaxy A36 5G', kind: 'phone', group: 'Android', line: 'Samsung A36' },
    { name: 'Samsung Galaxy A34 5G', kind: 'phone', group: 'Android' },
    { name: 'Samsung Galaxy A53 5G', kind: 'phone', group: 'Android' },
    { name: 'Samsung Galaxy A35 5G', kind: 'phone', group: 'Android' },
    { name: 'Samsung Galaxy A37 5G', kind: 'phone', group: 'Android' },
    { name: 'Samsung Galaxy A54 5G', kind: 'phone', group: 'Android' },
    { name: 'Samsung Galaxy S22', kind: 'phone', group: 'Android' },
    { name: 'Samsung Galaxy S23', kind: 'phone', group: 'Android' },
    { name: 'Samsung Galaxy S25', kind: 'phone', group: 'Android' }
];

// Lignes de l'accueil, dans l'ordre où les proposer dans les listes de choix.
export const HOME_LINES = ['660 G11', '850 G8/G10', 'X360', 'Zbook', 'iPhone 16e', 'iPhone 17', 'Samsung XCOVER 7', 'Samsung A36'];

// Familles de PC de l'accueil qui n'existent qu'en Occasion.
export const OCCASION_ONLY_LINES = new Set(['850 G8/G10']);
