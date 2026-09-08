export default function CriteriaTable({ criteria, perCriterion, notes = {} }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-chalk-500 border-b border-pitch-700">
          <th className="py-2 font-normal">Critère</th>
          <th className="py-2 font-normal text-right">Score /10</th>
          <th className="py-2 font-normal text-right">Statut</th>
        </tr>
      </thead>
      <tbody>
        {criteria.map((c) => {
          const value = perCriterion?.[c.key];
          const isComputed = value != null;
          return (
            <tr key={c.key} className="border-b border-pitch-800">
              <td className="py-2 pr-2">
                {c.label}
                {notes[c.key] && <span className="block text-xs text-chalk-500">{notes[c.key]}</span>}
              </td>
              <td className="py-2 text-right font-display text-base">{isComputed ? value : '—'}</td>
              <td className="py-2 text-right text-xs">
                {isComputed ? (
                  <span className="text-turf-400">Donnée réelle</span>
                ) : c.computable === 'partial' ? (
                  <span className="text-flood-400">Estimation partielle</span>
                ) : (
                  <span className="text-chalk-500">Source non configurée</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
