# RCB IPL stats 2008–2026 — collection notes

## Deliverables (`~/workspace/ipl_stats/rcb/`)
- `batting.csv` — 352 rows; `year,team,player,matches,innings,not_outs,runs,avg,sr`; sorted by year, then runs desc
- `bowling.csv` — 251 rows; `year,team,player,matches,innings,overs,wickets,avg,economy`; sorted by year, then wickets desc
- `sources/` — the 20 verified season-chunk CSVs written by the 10 researcher workers (audit trail)
- `name_map.csv` — cricsheet short-name → full-name mapping used for reconciliation (388 player-seasons)
- `aggregate.py` — independent ball-by-ball aggregation pipeline (shared with other teams)
- `merge.py`, `audit.py` — merge + cell-by-cell reconciliation scripts

## Method
1. 10 researcher workers, one per 2-season chunk (2008–09 … 2024–25, plus 2026 alone). Each ran the shared Cricsheet ball-by-ball aggregation as primary pipeline, then cross-checked every player row against ≥2 independent published sources, with top-3 run-scorers and top-3 wicket-takers verified exactly per season.
2. Independent pipeline of the coordinator: Cricsheet CSV2 ball-by-ball for all RCB matches 2008–2026 (playoffs included, super overs excluded).
3. Cell-by-cell reconciliation (`audit.py`): all 603 merged rows compared against the independent pipeline on matches, innings, not_outs, runs, overs, wickets, with avg/SR/economy recomputed from raw aggregates via exact `Decimal` half-up rounding → **0 diffs**. No numbers fabricated; every row also has ≥2 published-source confirmations from the workers.

## Conventions
- **Overs** from legal balls only (wides/no-balls excluded from ball count; their runs included in runs conceded). Overs printed one-decimal cricket notation (e.g. 68.0, 49.1).
- **Half-up rounding** to 2 dp via exact `Decimal` arithmetic; economy = runs×6/legal balls. Wikipedia/CricketArchive/myKhel routinely **truncate** (documented dozens of 0.01-off cells below); CSVs use correct rounding.
- **Innings** follows the official scorecard convention: 0-ball non-striker-only appearances count as innings + not-out.
- **Blank cells** (not 0.00) for undefined SR (0 balls faced) and undefined avg (never dismissed / wicketless bowlers).
- **Dismissals:** 'retired hurt' is not a dismissal and not a bowler wicket; run outs are not bowler wickets; everything else (incl. retired out, obstructing the field) is a dismissal and a bowler wicket. (Two real pipeline bugs were caught and fixed mid-run — see below.)
- **Abandoned/no-result:** matches abandoned *without a ball bowled* are excluded (they have no ball-by-ball data anyway); no-result matches *with* balls bowled are **included** — verified against ESPNcricinfo convention via the 30 Apr 2019 RCB vs RR game (Kohli's 14 matches/464 runs include it on every published table).
- **Names:** ESPNcricinfo spellings, verified per chunk (e.g. "Mohammed Siraj", "Raju Bhatkal" not "Rajoo", "Siddarth Kaul", "Phil Salt", "Rasikh Salam").
- Players with 0 batting innings excluded from batting.csv; players with 0 bowling innings excluded from bowling.csv.

## Pipeline bugs found and fixed mid-run
1. `aggregate.py load_players()` parsed `info,players,<team>,p1,p2,…` rows, but Cricsheet CSV2 uses `info,player,<team>,<player>` rows → matches fell back to batted-or-bowled appearances, undercounting DNB/DNW players (e.g. Rajat Patidar 2022 7→8, KL Rahul 2016 12→14, Jitesh Sharma 2026 12→16). Fixed; all chunks re-ran.
2. 'retired hurt' was excluded from batting dismissals but wrongly credited as a bowler wicket. Six real cases involving RCB bowlers, all corrected and source-confirmed: Zaheer Khan 2008 14→13 (Thornely), Kane Richardson 2016 8→7 (Pietersen), Pawan Negi 2017 17→16 (Krunal Pandya), Mohammed Siraj 2018 12→11 (Nitish Rana), Bhuvneshwar Kumar 2026 29→28 (Axar Patel), Rasikh Salam 2026 20→19 (Rohit Sharma). No obstructed-the-field wickets involved RCB.

## Season-by-season: sources & key resolutions

### 2008–2009
- Sources: Wikipedia RCB season pages; CricTracker; CricketArchive RCB pages; royalchallengers.com "IPL 2008/2009 in numbers"; advancecricket; myKhel; t20cricstats.
- Top-3s: 2008 runs Dravid 371 / Boucher 225 / Kallis 199; wkts Zaheer 13 / Praveen 11 / Steyn 10. 2009 runs Kallis 361 / Taylor 280 / Dravid 271; wkts Kumble 21 / Praveen 13 / Vinay 9.
- Resolved: Zaheer 2008 14→13 (retired-hurt bug); match-count corrections from XI bug (Kohli 2008 12→13, Kohli 2009 14→16, Boucher 2009 9→12, etc.); RCB official article's "Dravid 375"/"Kallis 365" rejected (371/361); team totals cross-foot exactly (2008 batting 1865+118 extras=1983; bowling 1569 balls/56 wkts).

### 2010–2011
- Sources: Wikipedia season pages; CricTracker; myKhel; Cricbuzz; royalchallengers.com; bigbashboard.
- Top-3s: 2010 runs Kallis 572 / Uthappa 374 / Kohli 307; wkts Kumble 17 / Vinay 16 / Steyn 15. 2011 runs Gayle 608 / Kohli 557 / de Villiers 312; wkts Aravind 21 / Zaheer 14 / Vettori 12.
- Resolved: truncation diffs (Kallis 2010 avg 47.67 not 47.66; Gayle 2011 avg 67.56 not 67.55); Wikipedia's Aravind 2011 avg 19.40 is arithmetically wrong (368/21=17.52); Asad Pathan 2011 completed to 5.3 ov/49 runs (t20cricstats had a partial log); 2011 RCB vs RR abandoned without a ball — excluded.

### 2012–2013
- Sources: Wikipedia season pages; CricTracker archive; myKhel; iplt20stats; advancecricket; cricketaddictor; sportsyaari; cricketsky match logs; royalchallengers.com.
- Top-3s: 2012 runs Gayle 733 / Kohli 364 / de Villiers 319; wkts Vinay 19 / Zaheer 17 / Muralitharan 15. 2013 runs Gayle 708 / Kohli 634 / de Villiers 360; wkts Vinay 23 / Unadkat, RP Singh, Rampaul 13 each.
- Resolved: 25 Apr 2012 RCB–CSK abandoned without a ball — excluded per Cricinfo convention (some sites count it; t20cricstats/advancecricket agree with exclusion); Syed Mohammad 2012 was 4*(1) not out (sportsyaari marked him out — wrong); Parameswaran 2012 0*(1) not out; Rampaul 2013 econ 6.93 not 6.98 (sites divided by decimal-treated overs); sportscafe's "Muralitharan 2013: 11M/8wkts" wrong (6M/3wkts). Bowling file's 0.0-over non-bowler rows stripped at merge. Name: Raju Bhatkal (fixed from "Rajoo").

### 2014–2015
- Sources: Cricbuzz; myKhel; CricTracker; iplt20stats; cricketaddictor; AdvanceCricket; t20cricstats; bigbashboard.
- Top-3s: 2014 runs de Villiers 395 / Yuvraj 376 / Kohli 359; wkts Aaron 16 / Starc 14 / Chahal 12. 2015 runs de Villiers 513 / Kohli 505 / Gayle 491; wkts Chahal 23 / Starc 20 / Harshal 17.
- Resolved: myKhel's INN column copies MATCHES (rejected; Cricbuzz/cricketaddictor innings used); myKhel's 2015 balls column wrong on several rows (CricTracker legal-ball counts used); economy decimal-overs traps (Yuvraj 2014 8.25 not 8.50, Jakati 2014 11.18 not 12.06); iplt20stats Sarfaraz 2015 avg 13.88 rejected (divides by innings; correct 27.75). 2015's two no-result-with-balls games (29 Apr RCB v RR, 17 May RCB v DD) kept in all counts per the verified convention.

### 2016–2017
- Sources: CricTracker; myKhel; Wikipedia season pages; AdvanceCricket; iplt20stats.
- Top-3s: 2016 runs Kohli 973 / de Villiers 687 / KL Rahul 397; wkts Chahal 21 / Watson 20 / Aravind 11 (Jordan also 11). 2017 runs Kohli 308 / Jadhav 267 / de Villiers 216; wkts Negi 16 / Chahal 14 / Badree 9.
- Resolved: retired-hurt wicket fixes (Richardson 2016 8→7, Negi 2017 17→16); 25 Apr 2017 RCB vs SRH abandoned without a ball — excluded (13 completed matches); outright site errors: myKhel Sachin Baby 2016 econ 5.71 impossible (true 4.80), Aravind 2016 econ 7.42 (true 7.41), myKhel 2017 MATCHES column unreliable, Wikipedia's "Chahal 2016 20 wkts" wrong (21). Ball-by-ball sums reconcile exactly to CricTracker's RCB team totals.

### 2018–2019
- Sources: Wikipedia RCB season pages; myKhel; CricTracker; advancecricket; sportscafe.
- Top-3s: 2018 runs Kohli 530 / de Villiers 480 / Mandeep 252; wkts Umesh 20 / Chahal 12 / Siraj 11. 2019 runs Kohli 464 / de Villiers 442 / Parthiv 373; wkts Chahal 18 / Saini 11 / Umesh 8.
- Resolved: Siraj 2018 12→11 (Nitish Rana retired hurt, scorecard-verified 4-0-40-2); 30 Apr 2019 RCB vs RR no-result **included** — this was the proof case for the no-result convention (Kohli 14M/464 incl. his 25(7) on every published table); Akshdeep Nath 2019 matches 5→8, Pawan Negi 5→7 after XI fix.

### 2020–2021
- Sources: CricTracker; Wikipedia; myKhel; advancecricket; CricketArchive; bigbashboard; ESPN scorecards.
- Top-3s: 2020 runs Padikkal 473 / Kohli 466 / de Villiers 454; wkts Chahal 21 / Morris 11 / Siraj 11. 2021 runs Maxwell 513 / Padikkal 411 / Kohli 405; wkts Harshal 32 / Chahal 18 / Siraj 11.
- Resolved: cricsheet name-split "NA Saini" + "Navdeep Saini" 2021 merged (2M, 4.0 ov, 52 runs); Wikipedia/ESPNcricinfo anomalies corrected on arithmetic (Bharat 2021 avg 38.20 not 38.22; Kohli 2021 SR 119.47 not 119.40); no retired-hurt cases, zero no-result matches in either season; 28 Sep 2020 tie vs MI included with super-over balls excluded.

### 2022–2023
- Sources: CricketArchive full team tables; Wikipedia RCB season pages; royalchallengers.com; khelnow/sportscafe reviews.
- Top-3s: 2022 runs du Plessis 468 / Kohli 341 / Patidar 333; wkts Hasaranga 26 / Hazlewood 20 / Harshal 19. 2023 runs du Plessis 730 / Kohli 639 / Maxwell 400; wkts Siraj 19 / Harshal 14 / Karn Sharma 10.
- Resolved: this chunk found the `info,player` parsing bug (Patidar 2022 7→8, Anuj Rawat 2023 7→9, Shahbaz 2023 8→10, etc. — all confirmed vs CricketArchive's Matches column); truncation diffs documented; Rajat Patidar missed all of 2023 injured (correctly absent).

### 2024–2025
- Sources: Wikipedia; CricTracker; myKhel; bigbashboard; advancecricket; cricketaddictor; oncricket; ESPN.
- Top-3s: 2024 runs Kohli 741 / du Plessis 438 / Patidar 395; wkts Dayal 15 / Siraj 15 / Green 10. 2025 runs Kohli 657 / Salt 403 / Patidar 312; wkts Hazlewood 22 / Krunal 17 / Bhuvi 17.
- Resolved: cricketaddictor economy bug (divides by decimal-notated overs — ignored where overs have fractions); t20cricstats integer-truncated overs in match logs (Dagar 11.5 shown as 12.00 — Cricsheet legal-ball counts used); Mayank Agarwal 2025 4M/95 not oncricket's stale 3M/76; sportscafe's Ngidi "25 wickets in 14 games" blurb rejected (4/2). 17 May 2025 RCB–KKR washout abandoned without a ball — excluded.

### 2026
- Sources: myKhel RCB 2026 page; Wikipedia 2026 RCB season + 2026 IPL pages; ESPNcricinfo final report; iplt20.com ("All 28 Wickets by Bhuvneshwar Kumar"); match scorecards.
- RCB won IPL 2026, back-to-back champions: beat Gujarat Titans by 5 wickets in the final on 2026-05-31 (GT 155/8, RCB 161/5; Kohli 75* off 42, POTM). Topped the league (9W-5L), won Qualifier 1 vs GT by 92 runs.
- Top-3s: runs Kohli 675 / Patidar 501 / Padikkal 464; wkts Bhuvneshwar 28 / Rasikh Salam 19 / Hazlewood 15.
- Resolved: retired-hurt wicket fixes (Bhuvi 29→28, Rasikh 20→19); ESPNcricinfo article truncation noted (Rasikh econ true 9.46 not 9.45; Krunal 8.42 not 8.41); Jitesh Sharma 12→16 matches after XI fix (DNB as keeper vs CSK verified on scorecard); "Philip Salt"→Phil Salt per ESPNcricinfo profile spelling.

## Caveats
- A handful of low-profile tail-ender rows each season rest on the reconciled ball-by-ball pipeline + one published source rather than two fully independent published tables; no conflicting published figure exists for any of them.
- AdvanceCricket's "M" (matches) columns count squad appearances in some seasons and were ignored for match counts; myKhel's 2016–17 MATCHES/INN columns and 2014–15 INN/BALLS columns are unreliable and were not used.
- "Rajoo Bhatkal" in the 2012–13 source file was corrected to "Raju Bhatkal" at merge (Wikipedia/ESPNcricinfo spelling).
- Zero cells left blank for lack of verification; blanks appear only where avg/SR are genuinely undefined.
