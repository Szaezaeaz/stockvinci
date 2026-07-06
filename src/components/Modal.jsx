import React from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;

    // Rendered via portal into document.body so the overlay's position:fixed
    // is always relative to the viewport, regardless of any ancestor
    // establishing a containing block (eg an animated transform/filter).
    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="btn-close-modal" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
