import React from 'react';
import Modal from './Modal';
import ReturnForm from './ReturnForm';

// Bouton "Retour" de l'accueil : une personne rapporte du matériel.
export default function ReturnModal({ isOpen, onClose, devices, loans, onReturn }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Retour matériel">
            <ReturnForm devices={devices} loans={loans} onSubmit={onReturn} onDone={onClose} />
        </Modal>
    );
}
