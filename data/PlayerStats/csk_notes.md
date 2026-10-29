# CSK IPL stats 2008–2026 — build notes

CSK were suspended in 2016 and 2017, so this dataset covers 17 seasons:
2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2018, 2019, 2020, 2021, 2022,
2023, 2024, 2025, 2026.

- `batting.csv` — 265 rows; `year,team,player,matches,innings,not_outs,runs,avg,sr`
- `bowling.csv` — 205 rows; `year,team,player,matches,innings,overs,wickets,avg,economy`
- Both sorted by year, then runs desc / wickets desc.
- `sources/` — per-season web-researcher CSVs (audit trail) plus `SOURCES.md`
  (provenance notes appended by the 2012/13 and 2026 researchers).
- `cricsheet_raw.txt` — raw Cricsheet ball-by-ball aggregates; `build_csk.py`
  (build script), `aggregate_csk.py` (aggregation script), `name_map.csv`
  (125 cricsheet→ESPNcricinfo name mappings).

## Method

Two independent pipelines, reconciled cell-by-cell:

1. **Cricsheet pipeline (primary):** `aggregate_csk.py` aggregates every CSK
   match's ball-by-ball data (`~/workspace/ipl_stats/cricsheet/`), then
   `build_csk.py` applies Decimal half-up rounding and ESPNcricinfo name
   spellings. Parsed player lists from `info,player,<team>,<player>` rows.
   'Retired hurt' is not a dismissal; every other dismissal kind (incl. run
   outs, obstructing the field, retired out) is a batting dismissal; only
   'run out' is withheld from the bowler's wicket credit.
2. **Web research (9 workers, one per 2-season chunk):** each season's full
   squad collected from ≥2 independent published sources (Wikipedia season
   tables, CricTracker, myKhel, Cricbuzz, CricketArchive, bigbashboard,
   iplt20.com, advancecricket, t20cricstats, cricketaddictor, …), with the
   top-3 run-scorers and top-3 wicket-takers verified exactly across sources.

Reconciliation result: **zero value discrepancies** between the two pipelines
across all 17 seasons. Every remaining difference was a naming or
zero-row convention choice (see below).

## Conventions

- Overs = legal balls / 6 in cricket notation; wides/no-balls excluded from
  ball counts, their runs included in runs conceded. Byes/legbyes excluded
  from runs conceded (verified: Hazlewood 4-0-54-0 vs RR, Oct 2021).
- Half-up rounding to 2 dp via exact Decimal arithmetic; economy = runs*6/balls.
  Wikipedia / ESPNcricinfo / myKhel / CricketArchive routinely **truncate**
  instead of rounding — dozens of 0.01-off display values corrected.
- Batting innings = official scorecard convention: 0-ball non-striker-only
  appearances count as innings + not-out (e.g. Chahar & Jadeja 2021, Hosein
  2026, Deshpande 2023 0*(1)).
- Blank cells (never 0.00) for undefined SR (0 balls faced) and undefined avg
  (never dismissed / wicketless). 7 batting rows have both blank (0-ball,
  never-dismissed tailenders).
- Playoff matches included; super overs excluded; ball-less abandonments
  excluded (2012 RCB v CSK, 2009 CSK v KKR Cape Town); no-result matches with
  balls bowled count (2023 Match 45 counts as a match for CSK, no batting
  innings added).
- matches = named in the playing XI (DNB/DNW count).
- Player names: ESPNcricinfo spellings — MS Dhoni (not Mahendra Singh Dhoni),
  Faf du Plessis, Subramaniam Badrinath, Narayan Jagadeesan, Thilan Thushara
  (2010 — the shared map originally had the wrong Nuwan Thushara, fixed),
  Ronit More (2015), Prashant Solanki (2022), Kartik Sharma, Prashant Veer,
  Ramakrishna Ghosh, Sarfaraz Khan, Sanju Samson, Spencer Johnson (2026),
  Matthew Short (2026), Yo Mahesh, Vidyut Sivaramakrishnan.
- Zero-innings players excluded per file: batting.csv lists only players who
  batted; bowling.csv only players who bowled. (Some web-researcher files in
  `sources/` include zero rows for full-XI completeness; the final CSVs do
  not.)

## Season-by-season sources & discrepancies

- **2008:** CA + bigbashboard + CricTracker + myKhel + Cricbuzz + Wiki.
  Raina 421 runs (Wiki table typo 456; its own infobox/avg/SR prove 421).
  Joginder Sharma avg 29.88 (Wiki 28.87 transposed digits), econ 9.69.
  Truncation corrections: Gony 26.06, Balaji 8.67, Murali 36.73/6.97,
  Dhoni SR 133.55, Vidyut 133.03, Fleming 118.79, Kapugedera 69.57.
  Raina bowling econ 5.93. Kapugedera's 3 bowling innings verified via
  individual scorecards (17 balls, 49 runs, 0 wkts).
- **2009:** CA + bigbashboard + Wiki + Cricbuzz + myKhel. Hayden 572;
  Raina 434 off 308 balls (CA said 309 — scorecard-by-scorecard check proves
  308; SR 140.91); Bailey 39 balls (not 38), SR 115.38. Truncation: Balaji
  avg 24.31, Badrinath 19.67/107.93, Oram 14.67, Patel 15.78/112.70.
  Ball-less abandonment v KKR (Cape Town, 25 Apr) excluded: Murali 13 M,
  Ashwin 2 M.
- **2010:** Cricsheet + Wiki + myKhel + Cricbuzz + advancecricket +
  t20cricstats. Badrinath avg 32.36 (Wiki 32.26 wrong — 11 dismissals incl. a
  run-out). Raina bowling 6 wkts/12 inn/143 balls/178 runs (t20cricstats said
  5 — the 6th was a run-out, correctly uncredited). Morkel 286 balls / 47.4
  ov (myKhel 284 wrong). Thushara econ 6.97 (myKhel 7.06 wrong-method).
  t20cricstats overs column sloppy; myKhel 2011-style INN bug noted.
  Cricsheet-only cells: Gony/Tyagi/Ganapathy/Perera bowling figures,
  Ganapathy batting 0*(0 balls), Thushara's 5th wicket runs.
- **2011:** Cricsheet + Wiki + myKhel + Cricbuzz + ESPNcricinfo records.
  Hussey 492 / Raina 438 / Vijay 434; Ashwin 20 (63.0), Bollinger 17 (47.0),
  Morkel 15 (45.0). Wiki/CLT20-contaminated infobox (Hussey 495, Ashwin 25)
  rejected — IPL-only figures used. myKhel INN column duplicated matches
  (Badrinath 39.60, Dhoni 32.67 wrong); Cricbuzz confirms 56.57/43.56.
  Cricsheet-only: Kulasekara/Styris/Raina bowling, Bollinger 0*(1 ball).
  Jakati 0-ball not-outs (2010 SF, 2011 v RCB) = inn + NO, blank SR.
- **2012:** CA + myKhel + Cricbuzz. Ball-less abandonment v RCB (25 Apr 2012)
  excluded — max 18 M (CA shows 19 for that XI; the 11 extra are exactly the
  abandoned game's XI). myKhel's ball counts lossy (Bravo 344 vs 346, Ashwin
  391 vs 395, Morkel 296 vs 297) and internally inconsistent — CA+Cricsheet
  agree to the ball; adopted (Ashwin 65.5 ov, econ 6.55). CA truncates
  (Ashwin 30.79, Morkel 7.78). Wiki Hussey 732 → 733 (5-to-1 outvoted).
  sportscafe "Hilfenhaus top wicket-taker" wrong — Bravo 15.
- **2013:** CA + myKhel + CricTracker + newschoupal. Hussey 733/566
  (orange cap); Bravo 32 wkts/62.3 ov/7.95 (purple cap); Mohit 20/50.4/6.43.
  myKhel Bravo 374 vs 375 balls, Mohit 302 vs 304 — same lossy-feed pattern,
  adopted CA+Cricsheet. Truncation: Dhoni SR 162.90, Hussey 129.51.
- **2014:** Cricsheet + bigbashboard + Cricbuzz + CricTracker +
  cricketaddictor + iplt20stats. Smith 566/416, Raina 523/359, McCullum
  405/333; Mohit 53.5/23/452/19.65/8.40, Jadeja 54.2/19/443/23.32/8.15,
  Ashwin 59.5/16/437/27.31/7.30. Raina 2014 balls 359 (sportskeeda 358
  rejected). cricketaddictor econ wrong-method (Mohit 8.45→8.40). myKhel
  Bravo 2015-style staleness n/a here. Cricsheet-only: Mohit batting inn=1,
  Smith bowling inn=5, D Hussey bowling inn=1, Pandey/Hastings/Vijay Shankar
  batting inn=0.
- **2015:** as 2014 sources. McCullum 436/280, Smith 399/335, du Plessis
  380/304, Raina 374/305 (bigbashboard 304 unexplained; cricbuzz 305 agrees
  with ball-by-ball; SR 122.62). Bravo 52.2/26/426/16.38/8.14 (17 M —
  myKhel 16 stale), Nehra 62.0/22/449/20.41/7.24, Mohit 57.0/14/481/34.36/
  8.44. cricketaddictor NO column systematically wrong; sportsyaari inns
  doubled; iplt20stats rounds fractional overs. Tye/Henry/Abbott/Irfan
  Pathan never in a CSK XI — correctly excluded.
- **2018:** Wiki + CricTracker + myKhel + t20cricstats + cricketaddictor +
  advancecricket + iplt20stats. Rayudu 602, Watson 555/154.60 (ESPN trunc.
  154.59), Dhoni 455/150.66; Thakur 16 (46.4/431/26.94/9.24), Bravo 14
  (53.3/533/38.07/9.96), Ngidi 11 (26.0/156/14.18/6.00). Harbhajan 31.5 ov
  (t20cricstats 32.00 wrong), Karn 9.3 ov (t20cricstats 9.00 wrong).
  cricketaddictor ECO wrong-method; indiafantasy rejected.
- **2019:** Wiki + CricTracker + Cricbuzz + myKhel + others. Dhoni 416/83.20/
  134.63, Watson 398, du Plessis 396; Tahir 26 (64.2/431/16.58/6.70),
  Chahar 22 (64.3/482/21.91/7.47), Harbhajan 16 (44.0/312/19.50/7.09 —
  Wiki 7.05 typo). Weakest links (1–2 published sources + Cricsheet, all
  exact): 2019 Vijay, Billings, Mohit, Kuggeleijn, Karn.
- **2020:** Cricsheet + CA + myKhel + advancecricket. du Plessis 449, Rayudu
  359, Watson 299; Curran 13 (42.0/344/26.46/8.19), Chahar 12 (52.0/396/
  33.00/7.62), Thakur 10 (32.2/275/27.50/8.51). IndiaFantasy Thakur figures
  rejected. 14 matches, no playoffs.
- **2021:** Cricsheet + myKhel + CricketAddictor + Sportskeeda +
  advancecricket. Gaikwad 635, du Plessis 633, Moeen 357; Thakur 21 (59.5/
  527/25.10/8.81), Bravo 14 (33.4/263/18.79/7.81), Chahar 14 (54.0/451/
  32.21/8.35). Rayudu retired hurt v MI (19 Sep) = inn + NO (13/4/28.56).
  0-ball non-striker inn+NO: Chahar v RR, Jadeja Q1 v DC. 16 matches.
- **2022:** advancecricket + myKhel + Wiki + CricTracker + CA. 14 matches,
  9th. Rayudu avg 24.91 (Wiki 24.90 truncation); Dube SR 156.22 (Wiki
  152.97 typo); Gaikwad avg 26.29 (Wiki 26.28 truncation).
- **2023:** myKhel + CricTracker + Wiki + Cricbuzz + scorecards. 16 matches,
  champions. Deshpande 56.5/21/564/26.86/9.92 (Wiki 26.85/9.95 inconsistent),
  Jadeja 57.0/20/431, Pathirana 46.2/19/371/19.53/8.01 (Wiki 376 typo),
  Chahar 34.0/13/297/22.85/8.74, Theekshana 49.0/11/392/35.64. Deshpande
  batting 1/1/0 (SR 0.00, avg blank); Santner 2/2/2 (avg blank); Chahar
  batting 1/1/1 (avg blank, SR 50.00). Match 45 no-result counts as match.
  Simarjeet 0 matches — excluded.
- **2024:** Cricsheet + myKhel + advancecricket + cricketaddictor +
  CricTracker + iplt20stats. 14 matches, 5th. Gaikwad 583/53.00/141.16,
  Dube 396/162.30, Mitchell 318/28.91; Deshpande 48.0/17/24.94/8.83,
  Mustafizur 34.2/14/22.71/9.26, Pathirana 22.0/13/13.00/7.68. Jadeja avg
  46.13 (46.125 — the one true banker's-rounding divergence). advancecricket
  M column wrong (Moeen 12, Rizvi 14, Shardul 14, Santner 11; phantom
  Mandal/Avanish/Solanki) — rejected. Gleeson 2* verified via 5 May 2024
  ball-by-ball.
- **2025:** Cricsheet + advancecricket + ESPN + myKhel + cricketaddictor.
  14 matches. Dube 357/32.45, Jadeja 301/33.44, Mhatre 240/34.29/188.98;
  Noor 50.0/24/408/17.00/8.16, Khaleel 46.4/15/447/29.80/9.58, Pathirana
  41.5/13/424/32.62/10.14. Conway retired out v PBKS (8 Apr) = dismissal.
  cricketaddictor Pathirana econ 10.22 wrong-method → 10.14. advancecricket
  Khaleel stale (12M/244 balls) rejected. Cricsheet-only tail cells: Tripathi
  55, Ashwin 33/7 wkts, Hooda 31, Overton 15*/0 wkts, Kamboj 14, Noor 7,
  Khaleel 1*, Mukesh 1/71, Ellis 1/38, Dube 2.0/33/0, Gleeson 2* (2024).
- **2026:** Cricsheet + iplt20.com official player pages + CricketAddictor +
  Wiki + myKhel + match reports. CSK 8th, 14 matches, no playoffs. **MS
  Dhoni played 0 matches** (calf injury — first IPL season missed since
  2008). Sanju Samson traded in: 477/288/43.36/165.63. Gaikwad 337, Kartik
  Sharma 295, Dube 270, Mhatre 201, Sarfaraz 161, Brevis 151, Overton 136,
  Urvil 129, Prashant Veer 90. Kamboj 50.2/21/530/25.24/10.53 (CA 49.8/10.64
  wrong), Overton 28.0/14/17.79/8.89, Noor 51.0/13/32.92/8.39, Hosein 24.4/8,
  Mukesh 28.0/8/249/31.13/8.89 (caught-and-bowled included). Jadeja and
  Curran traded to RR, Pathirana released, Ashwin not in squad, Ellis
  replaced by Spencer Johnson — none appeared for CSK. Hosein 0-ball
  non-striker appearance = inn + NO (avg blank). CA economy wrong-method for
  partial overs (Khaleel 8.67, Short 12.32, Gurjapneet 9.26); several CA
  profiles stale — final figures from CA team table + iplt20.com + Cricsheet.

## Known source quirks (recurring)

- Wikipedia/IPL season tables truncate displayed decimals — always recompute.
- myKhel: INN column sometimes duplicates matches; AVG shows runs for
  never-dismissed batters; ball counts occasionally stale/lossy.
- cricketaddictor: economy divides decimal-rendered overs (wrong for x.1–x.5);
  NO column unreliable; M column sometimes = matches batted.
- t20cricstats: overs/matches display buggy for low-appearance players; their
  balls/runs/wickets columns are reliable.
- iplt20stats: rounds overs to whole numbers — never use O/Eco for partial
  overs.
- indiafantasy / sportsyaari / sportscafe prose: rejected as unreliable where
  contradicted.
- stats.espncricinfo.com and howstat.com were inaccessible (blocked); the
  Cricsheet ball-by-ball + published tables pair is strictly more verifiable.
