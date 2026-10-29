import { formatNrr } from '../../lib/tournament/format';

const oversText = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;

// League table. The top `qualifiers` rows get the playoff marker; hovering a NRR shows the
// runs/overs it came from.
export default function PointsTable({ table, qualifiers, myUid }) {
    return (
        <div className="overflow-x-auto no-scrollbar bg-surface border border-border rounded-xl">
            <table className="w-full text-sm tabular-nums">
                <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-textMuted border-b border-border">
                        <th className="text-left font-normal px-3 py-2">#</th>
                        <th className="text-left font-normal px-2 py-2">Player</th>
                        <th className="font-normal px-2 py-2">P</th>
                        <th className="font-normal px-2 py-2">W</th>
                        <th className="font-normal px-2 py-2">L</th>
                        <th className="font-normal px-2 py-2">NR</th>
                        <th className="font-normal px-2 py-2">NRR</th>
                        <th className="font-normal px-3 py-2">Pts</th>
                    </tr>
                </thead>
                <tbody>
                    {table.map((r) => {
                        const q = r.position <= qualifiers;
                        return (
                            <tr
                                key={r.uid}
                                className={`border-b border-border last:border-0 ${r.uid === myUid ? 'bg-accentMuted' : ''} ${
                                    r.position === qualifiers ? 'border-b-2 border-b-accent/60' : ''
                                }`}
                            >
                                <td className="px-3 py-2">
                                    <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs ${q ? 'bg-accent text-white' : 'text-textMuted'}`}>
                                        {r.position}
                                    </span>
                                </td>
                                <td className="px-2 py-2 text-left text-text truncate max-w-[9rem]">{r.name}</td>
                                <td className="px-2 py-2 text-center text-textMuted">{r.played}</td>
                                <td className="px-2 py-2 text-center text-text">{r.won}</td>
                                <td className="px-2 py-2 text-center text-textMuted">{r.lost}</td>
                                <td className="px-2 py-2 text-center text-textMuted">{r.noResult}</td>
                                <td
                                    className={`px-2 py-2 text-center ${r.nrr > 0 ? 'text-win' : r.nrr < 0 ? 'text-loss' : 'text-textMuted'}`}
                                    title={`For ${r.runsFor}/${oversText(r.ballsFor)} ov · Against ${r.runsAgainst}/${oversText(r.ballsAgainst)} ov`}
                                >
                                    {formatNrr(r.nrr)}
                                </td>
                                <td className="px-3 py-2 text-center font-display text-text">{r.points}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <p className="px-3 py-2 text-[11px] text-textMuted border-t border-border">
                Top {qualifiers} qualify. Win 2, no result 1. NRR counts an all-out innings as 20 overs; walkovers don&apos;t count towards NRR.
            </p>
        </div>
    );
}
