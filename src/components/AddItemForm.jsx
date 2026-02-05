import React, { useState } from 'react';

export default function AddItemForm({ onAdd }) {
    const [name, setName] = useState('');
    const [user, setUser] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !user) return;

        onAdd({
            id: Date.now(),
            name,
            user,
            date: new Date().toLocaleString()
        });

        setName('');
        setUser('');
    };

    return (
        <div className="card">
            <h2>Sortie de stock</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="name">Matériel</label>
                    <input
                        id="name"
                        type="text"
                        placeholder="Ex: Laptop Dell XPS..."
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="user">Utilisateur (Bénéficiaire)</label>
                    <input
                        id="user"
                        type="text"
                        placeholder="Nom Prénom"
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        required
                    />
                </div>
                <button type="submit">Valider la sortie</button>
            </form>
        </div>
    );
}
