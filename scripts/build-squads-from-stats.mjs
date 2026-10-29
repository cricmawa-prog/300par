// Builds data/teams/<CODE>.json from the real per-season stats in data/playerStats/
// (Cricsheet ball-by-ball aggregates, cross-checked against published tables - see the
// <team>_notes.md files there). Replaces the old hand-typed gen-<team>-squads.mjs generators:
// every rating now comes from a sourced row; nothing is estimated, and a player who didn't
// play a season is simply absent from that season's squad.
//
// Usage: node scripts/build-squads-from-stats.mjs
//
// The CSVs only carry stats. Static player info (country, role, batting slots, keeper flag) is
// carried over from the existing data/teams/<CODE>.json where the player already exists, and
// otherwise is inferred from the stats; OVERRIDES (below) wins over both.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makePlayer } from '../lib/game/ratingFormula.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEAMS = ['SRH', 'RCB', 'CSK', 'MI'];

// Players not in the previous datasets. Everyone here is Indian unless listed in FOREIGN.
const FOREIGN = {
    'Billy Stanlake': 'Australia', 'Mitchell Marsh': 'Australia', 'Sean Abbott': 'Australia',
    'Vijayakanth Viyaskanth': 'Sri Lanka', 'David Payne': 'England', 'Dilshan Madushanka': 'Sri Lanka',
    'Ashley Noffke': 'Australia', 'Abdur Razzak': 'Bangladesh', 'Roelof van der Merwe': 'South Africa',
    'Jesse Ryder': 'New Zealand', 'Dillon du Preez': 'South Africa', 'Luke Pomersbach': 'Australia',
    'Nic Maddinson': 'Australia', 'Adam Milne': 'New Zealand', 'George Garton': 'England',
    'Michael Bracewell': 'New Zealand', 'Jacob Bethell': 'England', 'Tabraiz Shamsi': 'South Africa',
    'Chamara Kapugedera': 'Sri Lanka', 'Andrew Flintoff': 'England', 'Justin Kemp': 'South Africa',
    'Suraj Randiv': 'Sri Lanka', 'Ben Laughlin': 'Australia', 'Sam Billings': 'England', 'Mark Wood': 'England',
    'Dwaine Pretorius': 'South Africa', 'Richard Gleeson': 'England', 'Spencer Johnson': 'Australia',
    'John Hastings': 'Australia', 'Scott Kuggeleijn': 'New Zealand', 'Sisanda Magala': 'South Africa',
    'Nathan Ellis': 'Australia', 'Dominic Thornely': 'Australia', 'Graham Napier': 'England',
    'Mohammad Ashraful': 'Bangladesh', 'Ali Murtaza': 'West Indies', 'Aiden Blizzard': 'Australia',
    'Davy Jacobs': 'South Africa', 'Ray Price': 'Zimbabwe', 'Richard Levi': 'South Africa',
    'Robin Peterson': 'South Africa', 'Clint McKay': 'Australia', 'Ben Dunk': 'Australia',
    'Marchant de Lange': 'South Africa', 'Akila Dananjaya': 'Sri Lanka', 'Finn Allen': 'New Zealand',
    'Tristan Stubbs': 'South Africa', 'Duan Jansen': 'South Africa', 'Luke Wood': 'England',
    'Kwena Maphaka': 'South Africa', 'Allah Mohammad Ghazanfar': 'Afghanistan',
};
const KEEPERS = new Set([
    'Shreevats Goswami', 'Vishnu Vinod', 'Srikar Bharat', 'Manvinder Bisla', 'Sam Billings',
    'Narayan Jagadeesan', 'Urvil Patel', 'Davy Jacobs', 'Ben Dunk', 'Tirumalasetti Suman',
    'Tristan Stubbs', 'Robin Minz',
]);
const OPENERS = new Set([
    'Shreevats Goswami', 'Manvinder Bisla', 'Davy Jacobs', 'Ben Dunk', 'Aiden Blizzard', 'Richard Levi',
    'Finn Allen', 'Luke Pomersbach', 'Abhinav Mukund', 'Jesse Ryder', 'KL Rahul', 'Unmukt Chand',
    'Vijay Zol', 'Srikkanth Anirudha', 'Anirudha Srikkanth', 'Dwaraka Ravi Teja', 'Atharva Taide',
    'Sanvir Singh', 'Urvil Patel', 'Mitchell Marsh',
]);

// Hand-checked role / slot overrides (win over both the carried-over and the inferred info).
// The stats CSVs have no batting positions, so these come from reviewing the inferred players.
const B = [8, 9, 10, 11];
const AR = [6, 7, 8];
const OVERRIDES = {};
const setRole = (names, role, slots, isKeeper = false) => names.forEach((n) => { OVERRIDES[n] = { role, slots, isKeeper }; });
setRole([
    'David Payne', 'Dilshan Madushanka', 'Nathan Ellis', 'Mark Wood', 'Adam Milne', 'Akila Dananjaya', 'Marchant de Lange',
    'Richard Gleeson', 'Ankit Rajpoot', 'Pradeep Sangwan', 'Ramesh Powar', 'Ray Price', 'Nayan Doshi', 'Ashley Noffke',
    'Abdur Razzak', 'Raghav Goyal', 'Satyanarayana Raju', 'Shreyas Gopal', 'Rahul Shukla', 'Pawan Suyal', 'Abu Nechim', 'Himanshu Sharma',
], 'Bowler', B);
setRole([
    'Sean Abbott', 'John Hastings', 'Duan Jansen', 'Graham Napier', 'Shams Mulani', 'Raj Angad Bawa', 'Sanjay Yadav', 'Mayank Rawat',
    'Anukul Roy', 'Prashant Veer', 'Ramakrishna Ghosh', 'Rishi Dhawan', 'Jayant Yadav', 'Hrithik Shokeen', 'Ramandeep Singh',
    'Arshad Khan', 'Andrew Flintoff', 'Justin Kemp', 'Gurkeerat Singh Mann', 'Jesse Ryder', 'Michael Bracewell', 'Jacob Bethell',
    'Mayank Dagar', 'Mitchell Marsh', 'Ankit Sharma', 'Vivrant Sharma', 'Sanvir Singh', 'Manoj Bhandage', 'Abrar Kazi',
    'Rajesh Bishnoi', 'Dominic Thornely',
], 'All-rounder', AR);
setRole(['Chidhambaram Gautam', 'Salil Arora'], 'Wicketkeeper Batsman', [4, 5, 6, 7], true);
// Confirmed by the project owner:
setRole(['Abhinav Mukund', 'Atharva Taide'], 'Batsman', [1, 2]);
setRole(['Unmukt Chand', 'Srikkanth Anirudha', 'Anirudha Srikkanth'], 'Batsman', [1, 2, 3]);
setRole(['Vijay Zol'], 'Batsman', [3, 4]);
setRole(['Dwaraka Ravi Teja', 'Thalaivan Sargunam'], 'Batsman', [3, 4, 5]);
setRole(['Siddharth Chitnis'], 'All-rounder', [5, 6, 7]);
setRole(['Chandrasekar Ganapathy', 'Syed Mohammad'], 'All-rounder', [7, 8]);
setRole(['Rohan Raje'], 'All-rounder', [7, 8, 9]);
setRole(['Musavir Khote', 'Shivang Kumar'], 'All-rounder', [8, 9]);
setRole(['Chetanya Nanda', 'Prasanth Parameswaran'], 'Bowler', [10, 11]);

function parseCsv(file) {
    const [head, ...rows] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
    const keys = head.split(',');
    return rows.map((line) => {
        const cells = line.split(',');
        return Object.fromEntries(keys.map((k, i) => [k, cells[i]]));
    });
}
const num = (v) => (v === '' || v == null ? null : Number(v));

// Previous datasets -> static info per player (kept per team/year so role changes survive).
const oldInfo = {};
for (const code of TEAMS) {
    const file = path.join(root, 'data/teams', `${code}.json`);
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [year, squad] of Object.entries(data)) {
        for (const p of squad) {
            (oldInfo[p.name] ??= []).push({ code, year: Number(year), country: p.country, role: p.role, isKeeper: p.isKeeper, slots: p.slots });
        }
    }
}

function lookupInfo(name, code, year) {
    const entries = oldInfo[name];
    if (!entries) return null;
    const sameTeam = entries.filter((e) => e.code === code);
    const pool = sameTeam.length ? sameTeam : entries;
    return pool.reduce((best, e) => (Math.abs(e.year - year) < Math.abs(best.year - year) ? e : best));
}

function inferInfo(name, bat, bowl) {
    const country = FOREIGN[name] || 'India';
    const bowledOvers = bowl ? Number(bowl.overs) : 0;
    const runs = bat ? Number(bat.runs) : 0;
    const isKeeper = KEEPERS.has(name);
    let role;
    let slots;
    if (isKeeper) {
        role = 'Wicketkeeper Batsman';
        slots = OPENERS.has(name) ? [1, 2, 3, 4, 5, 7] : [4, 5, 6, 7];
    } else if (bowledOvers >= 10 && runs >= 100) {
        role = 'All-rounder';
        slots = [6, 7, 8];
    } else if (bowledOvers >= 6 && runs < 100) {
        role = 'Bowler';
        slots = [8, 9, 10, 11];
    } else {
        role = 'Batsman';
        slots = OPENERS.has(name) ? [1, 2, 3] : [3, 4, 5, 6];
    }
    return { country, role, isKeeper, slots };
}

for (const code of TEAMS) {
    const lc = code.toLowerCase();
    const batting = parseCsv(path.join(root, 'data/playerStats', `${lc}_batters_stats.csv`));
    const bowling = parseCsv(path.join(root, 'data/playerStats', `${lc}_bowling_stats.csv`));

    const seasons = {};
    const key = (r) => `${r.year}|${r.player}`;
    const batBy = new Map(batting.map((r) => [key(r), r]));
    const bowlBy = new Map(bowling.map((r) => [key(r), r]));
    const keys = new Set([...batBy.keys(), ...bowlBy.keys()]);

    for (const k of keys) {
        const [yearStr, name] = k.split('|');
        const year = Number(yearStr);
        const b = batBy.get(k);
        const w = bowlBy.get(k);
        const base = lookupInfo(name, code, year) || inferInfo(name, b, w);
        const info = OVERRIDES[name] ? { ...base, ...OVERRIDES[name] } : base;

        let bat = null;
        if (b) {
            const innings = Number(b.innings);
            const dismissals = innings - Number(b.not_outs);
            const avg = num(b.avg) ?? (dismissals > 0 ? Number(b.runs) / dismissals : Number(b.runs));
            bat = { avg, sr: num(b.sr) ?? 0, innings, runs: Number(b.runs) };
        }
        let bowl = null;
        if (w) {
            const wkts = Number(w.wickets);
            bowl = {
                avg: num(w.avg) ?? 50, // wicketless spell: no average -> worst-case for the formula
                eco: Number(w.economy),
                wkts,
                primary: info.role === 'Bowler' || info.role === 'All-rounder' || Number(w.overs) >= 8,
            };
        }
        const player = makePlayer(name, info.country, info.role, info.slots, info.isKeeper, bat, bowl);
        (seasons[year] ??= []).push(player);
    }

    for (const squad of Object.values(seasons)) {
        squad.sort((a, c) => c.BAT + c.POW + c.BWL - (a.BAT + a.POW + a.BWL));
    }
    const ordered = Object.fromEntries(Object.entries(seasons).sort(([a], [c]) => a - c));
    fs.writeFileSync(path.join(root, 'data/teams', `${code}.json`), JSON.stringify(ordered, null, 2) + '\n');
    const sizes = Object.entries(ordered).map(([y, s]) => `${y}:${s.length}`).join(' ');
    console.error(`${code}: ${Object.keys(ordered).length} seasons | ${sizes}`);
}
