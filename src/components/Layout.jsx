import React from 'react';

export default function Layout({ children }) {
    return (
        <div>
            <header>
                <h1>IT STOCK</h1>
            </header>
            <main className="container">
                {children}
            </main>
        </div>
    );
}
