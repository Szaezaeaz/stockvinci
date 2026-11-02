import React, { useCallback, useEffect, useMemo, useState } from 'react';
import LoginScreen from './LoginScreen';
import UpdateBanner from './UpdateBanner';
import { AuthContext } from '../utils/AuthContext';
import { AUTH_EXPIRED_EVENT, IDLE_LOCK_MS, getSession, idleFor, logout, markActivity, saveSession } from '../services/auth';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel'];
const CHECK_EVERY_MS = 15000;

// Rien de l'appli n'est affiché (ni chargé depuis le cloud) sans connexion. La
// session se verrouille après 15 min sans activité, ou quand le serveur la refuse
// (code changé, compte désactivé) : il faut retaper son code.
export default function AuthGate({ children }) {
    // Session restée ouverte plus de 15 min sans activité (appli fermée entre-temps) : verrouillée.
    const [session, setSession] = useState(() => (idleFor() >= IDLE_LOCK_MS ? null : getSession()));
    const [lastName, setLastName] = useState(() => getSession()?.user?.name || '');

    useEffect(() => {
        if (!session && getSession()) logout(); // jeton périmé : supprimé ici et sur le serveur
        // eslint-disable-next-line react-hooks/exhaustive-deps -- seulement au lancement
    }, []);

    const lock = useCallback(() => {
        setLastName(getSession()?.user?.name || '');
        logout();
        setSession(null);
    }, []);

    const replaceSession = useCallback((next) => {
        saveSession(next);
        setSession(next);
    }, []);

    useEffect(() => {
        if (!session) return undefined;
        const onActivity = () => markActivity();
        const check = () => {
            if (idleFor() >= IDLE_LOCK_MS) lock();
        };
        const onVisible = () => {
            if (document.visibilityState === 'visible') check();
        };
        ACTIVITY_EVENTS.forEach(name => window.addEventListener(name, onActivity, { passive: true }));
        window.addEventListener(AUTH_EXPIRED_EVENT, lock);
        document.addEventListener('visibilitychange', onVisible);
        const timer = setInterval(check, CHECK_EVERY_MS);
        return () => {
            ACTIVITY_EVENTS.forEach(name => window.removeEventListener(name, onActivity));
            window.removeEventListener(AUTH_EXPIRED_EVENT, lock);
            document.removeEventListener('visibilitychange', onVisible);
            clearInterval(timer);
        };
    }, [session, lock]);

    const context = useMemo(() => ({ user: session?.user || null, lock, replaceSession }), [session, lock, replaceSession]);

    return (
        <>
            <UpdateBanner />
            {session ? (
                <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
            ) : (
                <LoginScreen initialName={lastName} onLogin={replaceSession} />
            )}
        </>
    );
}
