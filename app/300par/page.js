import GameShell from '../../components/Game/GameShell';
import { getSeasonSquads, getTeams } from '../../lib/data/seasonSquads';

export const metadata = {
    title: '300 Par',
    description: 'Draft an IPL franchise XI across its history and chase an impossible 300.',
};

export default function ThreeHundredPar() {
    const teams = getTeams();
    const seasonSquadsByTeam = Object.fromEntries(teams.map((t) => [t.code, getSeasonSquads(t.code)]));
    const seasonCount = new Set(teams.flatMap((t) => Object.keys(seasonSquadsByTeam[t.code]))).size;

    return <GameShell teams={teams} seasonSquadsByTeam={seasonSquadsByTeam} seasonCount={seasonCount} />;
}
