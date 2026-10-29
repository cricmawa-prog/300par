# Mumbai Indians IPL stats 2008–2026 — build notes

MI played all 19 IPL seasons (2008–2026). This dataset covers all of them.

- `batting.csv` — 386 rows; `year,team,player,matches,innings,not_outs,runs,avg,sr`
- `bowling.csv` — 367 rows; `year,team,player,matches,innings,overs,wickets,avg,economy`
- Both sorted by year, then runs desc / wickets desc. `team` is always `MI`.
- `work/` — audit trail: per-chunk researcher CSVs + NOTES (`mi_2008_2010_web/`,
  `mi_2011_2013_web/`, `mi_2014_2016_web/`, `mi_2017_2019_web/`,
  `mi_2020_2022_web/`, `mi_2023_2024_web/`, `mi_2025_2026_web/`), the Cricsheet
  ball-by-ball raw aggregates (`cricsheet_raw.txt`), `aggregate_mi.py`
  (aggregation script), `build_mi.py` (this build script), `name_map.csv`
  (200 worker/cricsheet → ESPNcricinfo name spellings).

## Method

Two independent pipelines, reconciled cell-by-cell:

1. **Cricsheet pipeline (independent):** `aggregate_mi.py` aggregates every MI
   match's ball-by-ball data (`~/workspace/ipl_stats/cricsheet/`, 1243 matches,
   19 seasons). Player lists (matches played) come from
   `info,player,<team>,<player>` rows. Super overs excluded; playoffs included;
   no-result matches with balls bowled included; ball-less abandonments excluded.
2. **Web research (7 workers, one per season chunk):** each season's full squad
   collected from ≥2 independent published sources, with the top-3 run-scorers
   and top-3 wicket-takers verified exactly across sources, then programmatically
   diffed against the Cricsheet aggregates. Every diff was investigated and
   resolved on evidence — never guessed.

**Result: only 2 real diffs across 753 player-season rows** (both resolved, below).
Everything else matches exactly between ball-by-ball data and published tables.

## Conventions

- Overs in cricket notation from LEGAL balls only (wides/no-balls excluded from
  ball count; their runs included in runs conceded).
- avg / sr / economy recomputed from raw counts with Decimal ROUND_HALF_UP to
  2dp. Wikipedia/myKhel/CricketArchive routinely **truncate** rather than
  round — dozens of 0.01-off cells documented by researchers (e.g. Malinga 2019
  avg 27.38 not 27.37; Rohit 2013 avg 38.43 not 38.42; Bumrah 2025 avg 17.56).
  Final CSVs use correct rounding.
- Batting innings follow official scorecard convention: 0-ball non-striker
  appearances count as innings + not-out.
- Blank cells (not 0.00) for undefined SR (0 balls faced) and undefined avg
  (never dismissed / wicketless).
- 'Retired hurt' is NOT a dismissal (batting) and NOT a bowler wicket.
  'Retired out' IS a batting dismissal but NOT a bowler wicket.
  'Obstructing the field' is NOT a bowler wicket. 'Run out' is a batting
  dismissal but NOT a bowler wicket. (Matches official IPL/ESPNcricinfo figures;
  e.g. bigbashboard counts retired-hurt as a dismissal — corrected for Harbhajan
  2014 and Finch 2015.)
- 'matches' = matches in the playing XI (DNB/DNW players in the XI count).
- Player names in ESPNcricinfo spellings (`name_map.csv`); identified via
  scorecards: "AS Roy" = Anukul Roy (MI 2019, 1 match), "RW Price" = Ray Price
  (MI 2011, 1 match), "MA Khote" = Musavir Khote, "VS Yeligati" = Vikrant
  Yeligati, "RR Raje" = Rohan Raje, "C Madan" = Chandan Madan,
  "RA Shaikh" = Rahil Shaikh.

## The two resolved diffs

1. **DJ Bravo 2008 bowling — web 170 balls / 28.2 ov / econ 8.19 vs cricsheet
   171 / 28.3 / 8.14.** Root-caused: cricsheet match 335994 (MI v DC,
   27 Apr 2008) numbers Bravo's 2nd over 10.1–10.8 with one wide = 7 legal balls
   (phantom ball; numbering not reset after the wide). Official scorecard shows
   a 2-over spell. A scripted scan of the ENTIRE cricsheet dataset found only 4
   overs with >6 legal balls; the other 3 involve no MI player on either side.
   Final CSV uses the published 170/28.2/8.19 (runs conceded 232, wickets 11
   identical either way).
2. **Akash Madhwal 2023 wickets — published 14 vs cricsheet 15.** The extra
   wicket is Sai Sudharsan's 'retired out' (Qualifier 2, MI v GT). Official IPL
   stats do not credit retired-out to the bowler (unanimous across 8+ sources;
   219/14 = 15.64 published avg). Aggregation fixed: 'retired out' and
   'obstructing the field' are no longer credited as bowler wickets (only MI
   case in 19 seasons is this one). Final CSV: 14 wkts, 153 balls, 219 runs,
   avg 15.64, econ 8.59.

## Sources per chunk

- **2008–2010:** CricketArchive team tables (primary), bigbashboard (2009/10),
  iplt20stats per-player per-match pages, Cricbuzz, myKhel, Wikipedia, published
  scorecards.
- **2011–2013:** divercitytimes full tables, CricTracker, myKhel, Cricbuzz,
  iplt20stats, t20cricstats, cricketaddictor-family, bigbashboard,
  mumbaiindians.com, individual scorecards.
- **2014–2016:** bigbashboard (with raw ball counts), myKhel, CricTracker,
  Cricbuzz, CricketArchive.
- **2017–2019:** bigbashboard league tables, Wikipedia, CricTracker, myKhel,
  iplt20stats, advancecricket, cricketaddictor, Cricbuzz, scorecards.
- **2020–2022:** Wikipedia, myKhel, advancecricket, Cricbuzz, t20cricstats,
  iplt20stats. (MI 2020 super over vs KXIP excluded — de Kock 16 inns, Bumrah
  360 balls; MI missed playoffs 2021/2022.)
- **2023–2024:** myKhel, Cricbuzz, Wikipedia, tcni.in, corroborating outlets.
  (MI: 2023 playoffs — lost Qualifier 2; 2024 no playoffs.)
- **2025–2026:** Wikipedia, myKhel, CricTracker, cricketaddictor, Cricbuzz,
  official iplt20.com, Wisden. 2025: 16 matches (4th, won Eliminator, lost Q2).
  2026: 14 matches, 9th, no playoffs.

## Notable third-party errors rejected (all documented in chunk NOTES)

- iplt20stats 2012 wrong rows (Franklin 245/253 → 220/223; Rayudu 351/270 →
  333/252; Rohit 345 balls/17 inn → 342/16); advancecricket de Kock 2021
  296→297 runs; myKhel ball-count deficits (1–4) on 7 bowler rows 2011–13;
  myKhel 2011–13 bowler MATCHES = innings bowled (Ojha 2013: 15 → 16 XIs);
  myKhel 2017 2011-era page HTTP 403; Wiki 2021 stale batting table + Krunal
  13.1-over typo; Wiki/myKhel truncation diffs (~40 cells, recomputed);
  cricketaddictor "NO" column is actually dismissals; Brevis 2022 Wiki SR typo;
  Tilak Varma 2025 advancecricket "retired hurt" mislabel (was retired out —
  dismissal stands, avg 31.18); Will Jacks 2025 matches 14→13; Corbin Bosch
  2025 matches 2→3; Naman Dhir 2026 319/217 → 318/216; cricketaddictor computed
  2025 economies by dividing by decimal overs (Boult 9.01→8.97, Santner
  7.96→7.92); iplt20stats Rohit 2025 avg 27.87 ignored a not-out → 29.86;
  LatestLY Bumrah 2017 60.2 overs included the excluded super over.

## Caveats

- A handful of 0-run tail-ender `balls_faced` cells (2019/20/21/22/26, and
  Vinay Kumar 2015, Bumrah 2015, Chand 2016) are cricsheet-only — published
  aggregate tables omit them; they don't affect any avg/SR in the final CSVs
  (SR defined = 0.00 where balls faced > 0; blank only where 0 balls faced).
- Bumrah 2019 not-outs: cricsheet 2 vs cricketaddictor 3 — used cricsheet
  (cricketaddictor demonstrably wrong on his 2017 figures); affects no
  published cell.
- No fabrication anywhere: every row traces to ball-by-ball data and ≥2
  independent published sources.
