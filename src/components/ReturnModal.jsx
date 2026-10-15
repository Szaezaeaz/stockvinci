import React from 'react';
import Modal from './Modal';
import ReturnForm from './ReturnForm';

// Retour de matériel : bouton "Retour" de l'accueil, ou "Matériel rendu" d'une attribution
// de l'onglet Attribué (prefill : { name, serials, items } à préremplir).
export default function ReturnModal({ isOpen, onClose, devices, loans, onReturn, prefill }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Retour matériels">
            <ReturnForm
                devices={devices}
                loans={loans}
                onSubmit={onReturn}
                onDone={onClose}
                initialName={prefill?.name || ''}
                preselect={prefill?.name ? prefill : null}
            />
        </Modal>
    );
}
