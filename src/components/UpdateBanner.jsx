import React, { useEffect, useState } from 'react';

const CHECK_EVERY_MS = 30 * 60 * 1000;

// Bandeau "nouvelle version" : l'appli installée garde l'ancienne version tant
// qu'elle n'est pas rechargée. On vérifie régulièrement (et au retour sur l'appli)
// s'il y a une mise à jour ; quand elle est prête, on propose de recharger plutôt
// que de recharger d'office (un formulaire en cours serait perdu).
export default function UpdateBanner() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const sw = navigator.serviceWorker;
        if (!sw) return undefined;
        // Au tout premier lancement, l'appli prend aussi la main : ce n'est pas une mise à jour.
        const hadController = Boolean(sw.controller);
        const onControllerChange = () => { if (hadController) setReady(true); };
        const check = () => {
            if (!navigator.onLine) return;
            sw.getRegistration().then(registration => registration?.update()).catch(() => {});
        };
        const onVisible = () => { if (document.visibilityState === 'visible') check(); };

        sw.addEventListener('controllerchange', onControllerChange);
        document.addEventListener('visibilitychange', onVisible);
        const timer = setInterval(check, CHECK_EVERY_MS);
        return () => {
            sw.removeEventListener('controllerchange', onControllerChange);
            document.removeEventListener('visibilitychange', onVisible);
            clearInterval(timer);
        };
    }, []);

    if (!ready) return null;
    return (
        <div className="update-banner">
            <span>Une nouvelle version de l’appli est disponible.</span>
            <button type="button" onClick={() => window.location.reload()}>Mettre à jour</button>
        </div>
    );
}
