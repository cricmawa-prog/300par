import srh from '../../data/teams/SRH.json';
import rcb from '../../data/teams/RCB.json';
import csk from '../../data/teams/CSK.json';
import mi from '../../data/teams/MI.json';
import { TEAMS } from '../../data/teams/index.js';

// Static imports so webpack can bundle each team's JSON. Add a new team by importing its
// data/teams/<CODE>.json here and adding it to TEAM_DATA + data/teams/index.js.
const TEAM_DATA = { SRH: srh, RCB: rcb, CSK: csk, MI: mi };

export function getTeams() {
    return TEAMS.filter((t) => TEAM_DATA[t.code]);
}

export function getSeasonSquads(teamCode) {
    return TEAM_DATA[teamCode] || {};
}

export function getSeasonYears(teamCode) {
    return Object.keys(getSeasonSquads(teamCode)).map(Number).sort();
}

export function getSquadForYear(teamCode, year) {
    return getSeasonSquads(teamCode)[String(year)] || [];
}
