import React, { useEffect, useRef } from 'react';

// Clavier AZERTY à l'écran pour saisir un NOM et un Prénom quand la tablette ne
// propose pas le sien (elle le masque dès qu'un clavier physique, comme la
// douchette, est branché). Il ne contient que ce qu'il faut pour un nom : lettres,
// accents courants, tiret, apostrophe et espace.

const LETTER_ROWS = ['azertyuiop'.split(''), 'qsdfghjklm'.split('')];
const LAST_ROW = 'wxcvbn'.split('');
const ACCENTS = 'éèêëàâîïôùûç'.split('');

const REPEAT_DELAY_MS = 450;
const REPEAT_EVERY_MS = 70;

// upper : les lettres s'affichent (et se saisissent) en majuscules.
// shiftOn : la touche ⇧ est enfoncée pour la prochaine lettre.
export default function OnScreenKeyboard({ upper, shiftOn, onShift, onChar, onBackspace, onNext, nextLabel }) {
    const backspaceRef = useRef(onBackspace);
    const timersRef = useRef({ delay: null, repeat: null });

    useEffect(() => {
        backspaceRef.current = onBackspace;
    });

    const stopRepeat = () => {
        clearTimeout(timersRef.current.delay);
        clearInterval(timersRef.current.repeat);
    };
    useEffect(() => stopRepeat, []);

    // Effacer : un appui efface une lettre, un appui long efface en continu.
    const startBackspace = () => {
        backspaceRef.current();
        stopRepeat();
        timersRef.current.delay = setTimeout(() => {
            timersRef.current.repeat = setInterval(() => backspaceRef.current(), REPEAT_EVERY_MS);
        }, REPEAT_DELAY_MS);
    };

    // mouseDown : le champ garde le focus pendant qu'on tape sur une touche.
    const keepFocus = (e) => e.preventDefault();
    const show = (letter) => (upper ? letter.toUpperCase() : letter);

    const charKey = (char, className = '') => (
        <button key={char} type="button" className={`osk-key ${className}`.trim()} onMouseDown={keepFocus} onClick={() => onChar(char)}>
            {show(char)}
        </button>
    );

    return (
        <div className="osk" role="group" aria-label="Clavier à l’écran">
            {LETTER_ROWS.map(row => (
                <div key={row.join('')} className="osk-row">{row.map(char => charKey(char))}</div>
            ))}
            <div className="osk-row">
                <button
                    type="button"
                    className={`osk-key osk-key-wide osk-key-action${shiftOn ? ' osk-key-on' : ''}`}
                    aria-label="Majuscule"
                    aria-pressed={shiftOn}
                    onMouseDown={keepFocus}
                    onClick={onShift}
                >
                    ⇧
                </button>
                {LAST_ROW.map(char => charKey(char))}
                <button
                    type="button"
                    className="osk-key osk-key-wide osk-key-action"
                    aria-label="Effacer"
                    onMouseDown={keepFocus}
                    onPointerDown={startBackspace}
                    onPointerUp={stopRepeat}
                    onPointerLeave={stopRepeat}
                    onPointerCancel={stopRepeat}
                >
                    ⌫
                </button>
            </div>
            <div className="osk-row">{ACCENTS.map(char => charKey(char, 'osk-key-small'))}</div>
            <div className="osk-row">
                {charKey('-', 'osk-key-action')}
                {charKey("'", 'osk-key-action')}
                <button type="button" className="osk-key osk-key-space" onMouseDown={keepFocus} onClick={() => onChar(' ')}>
                    espace
                </button>
                <button type="button" className="osk-key osk-key-next" onMouseDown={keepFocus} onClick={onNext}>
                    {nextLabel}
                </button>
            </div>
        </div>
    );
}
