import React, { useState } from 'react';
import Modal from './Modal';

export default function WithdrawModal({ isOpen, onClose, itemName, onConfirm }) {
    const [recipient, setRecipient] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(recipient.trim() || 'Anonyme');
        setRecipient('');
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Sortie de stock : ${itemName}`}
        >
            <form onSubmit={handleSubmit} className="loan-form-modal">
                <div className="form-group">
                    <label>Qui récupère ce matériel ?</label>
                    <input
                        type="text"
                        className="loan-input full-width"
                        placeholder="Nom du collaborateur (ou vide pour Anonyme)"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        autoFocus
                    />
                </div>
                <button type="submit" className="btn-add full-width-btn">
                    Valider la sortie
                </button>
            </form>
        </Modal>
    );
}
