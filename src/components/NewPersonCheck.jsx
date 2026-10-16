import React, { useContext, useState } from 'react';
import Modal from './Modal';
import { PeopleContext } from '../utils/PeopleContext';
import { isKnownPerson, similarPeople } from '../utils/person';

// Avant d'attribuer ou de donner du matériel à quelqu'un qui n'est pas encore dans
// l'appli, on demande confirmation : une faute de frappe créerait un doublon. Les
// personnes au nom proche sont proposées.
//
//   const { confirmPerson, dialog } = useNewPersonCheck();
//   confirmPerson(name, (finalName) => ...);   // finalName : nom saisi ou personne choisie
//   ... {dialog} dans le rendu
export function useNewPersonCheck() {
    const people = useContext(PeopleContext);
    const [pending, setPending] = useState(null); // { name, similar, proceed }

    const confirmPerson = (name, proceed) => {
        if (!name || isKnownPerson(people, name)) {
            proceed(name);
            return;
        }
        setPending({ name, similar: similarPeople(people, name), proceed });
    };

    const finish = (finalName) => {
        const { proceed } = pending;
        setPending(null);
        proceed(finalName);
    };

    const dialog = (
        <Modal isOpen={Boolean(pending)} onClose={() => setPending(null)} title="Nouvelle personne ?">
            {pending && (
                <div className="new-person">
                    <p className="new-person-text">
                        <strong>{pending.name}</strong> n’existe pas encore dans l’appli.
                    </p>

                    {pending.similar.length > 0 && (
                        <>
                            <p className="new-person-hint">Tu voulais peut-être dire :</p>
                            <div className="new-person-similar">
                                {pending.similar.map(person => (
                                    <button key={person.name} type="button" className="name-suggestion" onClick={() => finish(person.name)}>
                                        <span>{person.name}</span>
                                        {person.devices > 0 && <small>{person.devices} appareil{person.devices > 1 ? 's' : ''}</small>}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="new-person-actions">
                        <button type="button" className="btn-secondary" onClick={() => setPending(null)}>
                            Corriger le nom
                        </button>
                        <button type="button" className="btn-add" onClick={() => finish(pending.name)}>
                            Oui, créer {pending.name}
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );

    return { confirmPerson, dialog };
}
