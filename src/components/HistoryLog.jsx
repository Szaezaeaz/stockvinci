import React, { useState } from 'react';

export default function HistoryLog({ history }) {
    const [expandedMonths, setExpandedMonths] = useState({});

    if (history.length === 0) {
        return (
            <div className="history-section">
                <h2>Historique</h2>
                <p style={{ color: '#999', textAlign: 'center' }}>Aucun mouvement.</p>
            </div>
        );
    }

    // Group by Month (Month Year) -> Date (DD/MM/YYYY)
    const groupedByMonth = history.reduce((months, item) => {
        const dateObj = new Date(item.date);
        // Month Key: "February 2026" or "Février 2026"
        const monthKey = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        // Day Key: "04/02/2026"
        const dateKey = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        if (!months[monthKey]) {
            months[monthKey] = {};
        }
        if (!months[monthKey][dateKey]) {
            months[monthKey][dateKey] = [];
        }
        months[monthKey][dateKey].push(item);
        return months;
    }, {});

    const sortedMonths = Object.keys(groupedByMonth); // Roughly sorted if input is sorted.

    const toggleMonth = (month) => {
        setExpandedMonths(prev => ({
            ...prev,
            [month]: !prev[month]
        }));
    };

    // Helper to aggregate history items
    const aggregateHistory = (items) => {
        if (!items || items.length === 0) return [];

        // Sort by date descending (newest first)
        const sorted = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
        const aggregated = [];

        // Iterate and group
        for (const item of sorted) {
            if (aggregated.length === 0) {
                aggregated.push({ ...item, count: 1 });
                continue;
            }

            const lastItem = aggregated[aggregated.length - 1];
            const timeDiff = Math.abs(new Date(lastItem.date) - new Date(item.date));
            const isSameCategory = lastItem.category === item.category;
            // Check if both are positive or both are negative (same direction)
            const isSameDirection = (lastItem.delta > 0 && item.delta > 0) || (lastItem.delta < 0 && item.delta < 0);
            const isWithinTimeWindow = timeDiff <= 3 * 60 * 1000; // 3 minutes

            if (isSameCategory && isSameDirection && isWithinTimeWindow) {
                // Merge into the last item (which is the newer one effectively in the list representation, 
                // but we keep the 'latest' timestamp as the key for the group)
                lastItem.delta += item.delta;
                lastItem.count += 1;
                // Keep the timestamp of the newest item (which is already lastItem.date)
            } else {
                aggregated.push({ ...item, count: 1 });
            }
        }

        return aggregated;
    };

    return (
        <div className="history-section">
            <h2>Historique récent</h2>
            <div className="history-container">
                {sortedMonths.map(monthKey => {
                    const isExpanded = !!expandedMonths[monthKey];
                    const days = groupedByMonth[monthKey];
                    const sortedDays = Object.keys(days);

                    return (
                        <div key={monthKey} className="history-month-group">
                            <div
                                className={`history-month-header ${isExpanded ? 'expanded' : ''}`}
                                onClick={() => toggleMonth(monthKey)}
                            >
                                <span className="month-label">{monthKey}</span>
                                <span className="month-icon">{isExpanded ? '▼' : '▶'}</span>
                            </div>

                            {isExpanded && (
                                <div className="history-month-content fade-in">
                                    {sortedDays.map(dateKey => {
                                        const aggregatedItems = aggregateHistory(days[dateKey]);

                                        return (
                                            <div key={dateKey} className="history-day-group">
                                                <div className="history-date-header">{dateKey}</div>
                                                <ul className="history-list-compact">
                                                    {aggregatedItems.map(item => {
                                                        const isIn = item.delta > 0;
                                                        const dateObj = new Date(item.date);
                                                        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                                        return (
                                                            <li key={item.id} className={`history-item-compact ${isIn ? 'in' : 'out'}`} style={{ alignItems: 'flex-start' }}>
                                                                <span className="history-time-compact">{timeStr}</span>
                                                                <div className="history-category-compact" style={{ display: 'flex', flexDirection: 'column' }}>
                                                                    <div style={{ fontWeight: 500 }}>
                                                                        {item.category}
                                                                        {item.count > 1 && <span style={{ fontSize: '0.8em', opacity: 0.7, marginLeft: '6px' }}>({item.count} items)</span>}
                                                                    </div>

                                                                    {/* Display Recipient if present */}
                                                                    {item.recipient && item.recipient !== 'Anonyme' && (
                                                                        <div style={{ fontSize: '0.85em', color: '#64748b', marginTop: '2px' }}>
                                                                            👤 {item.recipient}
                                                                        </div>
                                                                    )}

                                                                    {/* Display Package Details if present */}
                                                                    {item.details && item.details.length > 0 && (
                                                                        <div style={{ fontSize: '0.8em', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>
                                                                            {item.details.join(', ')}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <span className="history-delta-compact">
                                                                    {isIn ? '+' : ''}{item.delta}
                                                                </span>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
