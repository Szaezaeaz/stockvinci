import { createContext } from 'react';

// Personne connectée et actions de session (voir components/AuthGate) :
// { user: { id, name, role }, lock(), replaceSession(session) }.
export const AuthContext = createContext({ user: null, lock: () => {}, replaceSession: () => {} });
