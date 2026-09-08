const DAY_LABELS = ["Aujourd'hui", 'Demain', 'J+2', 'J+3', 'J+4'];

export default function DateNav({ dates, activeDate, onSelect }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-pitch-700 pb-0" aria-label="Sélection du jour">
      {dates.map((date, i) => {
        const isActive = date === activeDate;
        return (
          <button
            key={date}
            onClick={() => onSelect(date)}
            className={`shrink-0 px-4 py-3 font-display text-lg tracking-tight transition-colors border-b-2 ${
              isActive
                ? 'border-turf-500 text-chalk-100'
                : 'border-transparent text-chalk-500 hover:text-chalk-300'
            }`}
          >
            {DAY_LABELS[i] || date}
            <span className="block text-xs font-body text-chalk-500 normal-case tracking-normal">
              {formatDate(date)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
