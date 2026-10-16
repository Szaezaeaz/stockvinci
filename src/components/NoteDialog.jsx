import React, { useState } from 'react';
import Modal from './Modal';
import NoteField from './NoteField';

// Petite fenêtre avec un commentaire : remise du matériel ("Confirmer la remise") ou
// modification du commentaire d'une attribution ou d'un appareil. Rendue seulement
// quand elle est ouverte : le champ repart de initial à chaque ouverture.
export default function NoteDialog({ title, intro, initial = '', presets = [], confirmLabel = 'Enregistrer', allowClear = false, onConfirm, onClose }) {
    const [note, setNote] = useState(initial);

    const submit = (e) => {
        e.preventDefault();
        onConfirm(note);
        onClose();
    };

    return (
        <Modal isOpen onClose={onClose} title={title}>
            <form onSubmit={submit} className="note-dialog">
                {intro && <p className="note-dialog-intro">{intro}</p>}
                <NoteField value={note} onChange={setNote} presets={presets} />
                <div className="new-person-actions">
                    {allowClear && initial ? (
                        <button type="button" className="btn-secondary" onClick={() => { onConfirm(''); onClose(); }}>
                            Effacer le commentaire
                        </button>
                    ) : (
                        <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
                    )}
                    <button type="submit" className="btn-add">{confirmLabel}</button>
                </div>
            </form>
        </Modal>
    );
}
