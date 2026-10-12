import React from 'react';
import { getLoanSerials } from '../utils/loans';
import { conditionOfStockKey, deviceModelLabel } from '../utils/models';

// Pastilles d'une attribution : chaque article, avec le n° de série de l'appareil
// correspondant quand il est suivi (le premier appareil de la même ligne de stock
// non encore associé) : la pastille porte alors son modèle précis et son état.
// Les n° de série sans appareil connu sont ajoutés à la fin.
function chipsOf(loan, devices) {
    const remaining = getLoanSerials(loan).filter(serial => devices?.[serial]);
    const chips = (loan.items || []).map(item => {
        const index = remaining.findIndex(serial => devices[serial].model === item);
        if (index === -1) return { label: item, serial: null };
        const [serial] = remaining.splice(index, 1);
        const device = devices[serial];
        const condition = device.exactModel ? conditionOfStockKey(item) : '';
        return { label: deviceModelLabel(device), serial, detail: condition ? ` · ${condition}` : '' };
    });
    getLoanSerials(loan)
        .filter(serial => !devices?.[serial])
        .forEach(serial => chips.push({ label: 'Appareil supprimé', serial }));
    return chips;
}

export default function LoanChips({ loan, devices }) {
    return (
        <div className="assignment-items">
            {chipsOf(loan, devices).map((chip, index) => (
                <span key={index} className={`assignment-chip${chip.serial ? ' assignment-chip-pc' : ''}`}>
                    {chip.label}
                    {chip.serial && <small>S/N {chip.serial}{chip.detail}</small>}
                </span>
            ))}
        </div>
    );
}
