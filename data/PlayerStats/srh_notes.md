# Notes — SRH IPL stats 2013–2026

## Method
- Primary figures computed independently from Cricsheet ball-by-ball data
  (https://cricsheet.org/downloads/ipl_csv2.zip, downloaded 2026-10-02, covers
  IPL 2008–2026; SRH seasons 2013–2026 extracted, playoffs included).
- Cross-checked against web sources collected per season by independent
  researchers: ESPNcricinfo records/statsguru, iplt20.com/stats, howstat.com,
  Wikipedia season tables (which cite ESPNcricinfo), CricTracker, myKhel, etc.
  Top-3 run-scorers and top-3 wicket-takers per season verified exactly across
  ≥2 independent sources before publishing.
- Player names use ESPNcricinfo full-name forms. Cricsheet short names mapped
  via the Cricsheet people registry; "S Arora"/"Salil Arora" merged (same
  registry id); "AU Rashid" = Adil Rashid (confirmed via SRH 2023 squad lists).

## Conventions (match official published IPL stats)
- Batting: matches = SRH appearances (playing XI from match info files);
  innings = innings batted (appearing as striker or non-striker counts);
  not_outs includes "retired hurt" (not out) but not "retired out".
  Strike rate = runs*100/balls faced; balls faced excludes wides, includes
  no-balls faced. Avg blank when never dismissed.
- Bowling: innings = innings bowled in; overs counted as LEGAL balls/6 in
  cricket notation (e.g. 49.1 = 49 overs + 1 ball) — wides and no-balls are
  NOT counted as balls in the over total, but their runs ARE included in runs
  conceded (this matches ESPNcricinfo/IPLT20 published figures; verified e.g.
  Rashid Khan 2018: 68.0 ov / 458 runs / econ 6.74; Umran Malik 2022:
  49.1 ov / 444 runs / econ 9.03).
- Wickets credited to bowler: bowled, caught (incl. caught & bowled), lbw,
  stumped, hit wicket. NOT credited: run out, retired out, retired hurt,
  obstructing the field, timed out.
- Super overs are EXCLUDED from all aggregates (official IPL convention).
  SRH super overs in this period: 2013 vs RCB, 2019 vs MI, 2020 vs KKR,
  2021 vs DC.
- Season stat totals include playoff matches. 2024: SRH's league game vs GT
  (16 May 2024, Hyderabad) was washed out with no ball bowled — not counted
  as a match for any player (16 counted matches = 13 completed league games
  + 3 playoffs).

## Season sources
- 2013, 2014: web research (ESPNcricinfo records, iplt20.com, howstat) + full
  cell-by-cell cross-check vs Cricsheet computation. All cells agree.
- 2017, 2018: web research (Wikipedia, CricTracker, myKhel, iplt20stats,
  Cricbuzz scorecards) + cross-check vs Cricsheet computation. All cells
  agree except the three innings corrections and rounding notes below.
- 2019, 2020: Cricsheet JSON computation + cross-check vs Wikipedia season
  tables (ESPNcricinfo-sourced), CricTracker, SportsTak, myKhel and others.
  All cells agree except documented conventions below.
- 2021, 2022: web research (myKhel full tables, CricTracker, AdvanceCricket,
  t20cricstats, indiafantasy, cricketaddictor) + cross-check vs Cricsheet
  computation. All cells agree except rounding notes below.
- 2023, 2024: Cricsheet ball-by-ball computation + cross-check vs
  CricketArchive event pages, Wikipedia (ESPNcricinfo-sourced), Cricbuzz,
  CricTracker. All runs/wickets/overs/matches agree; avg/SR/econ use half-up
  rounding where CA/Wiki truncate (e.g. Abhishek Sharma 2024 avg 32.27 not
  32.26, SR 204.22 not 204.21; Klaasen 2024 avg 39.92 not 39.91;
  Natarajan 2024 econ 9.06 not 9.05; Cummins 2024 econ 9.28 not 9.27 —
  Cricbuzz's rounded figures agree with the CSV). Glenn Phillips 2023:
  2 bowling innings per ball-by-ball (a myfinal11 table's "3" rejected).
- 2025, 2026: Cricsheet ball-by-ball computation + cross-check vs official
  IPL player pages (iplt20.com), CricTracker, Wisden, myKhel, Wikipedia.
  All cells agree except documented conventions below.
- IPL 2025: SRH 6th (6W-7L-1NR), 14 matches, no playoffs. Champions: RCB
  (beat Punjab Kings in final).
- IPL 2026: SRH 3rd in league (9W-5L), lost Eliminator to RR by 47 runs,
  15 matches. Champions: RCB back-to-back (beat Gujarat Titans by 5 wickets).

## Discrepancies / caveats
- Cricsheet ball-by-ball contains 3 extra wide-ball deliveries for Rashid Khan
  2018 (vs MI 12 Apr 2018: 1 wide; vs RCB 7 May 2018: 2 wides) that official
  scorecards record as 4.0 overs. Published figures use 68.0 overs; the CSV
  follows the published figure.
- Batting innings convention: an appearance as non-striker (0 balls faced,
  listed "not out" on the scorecard, e.g. Rashid Khan 0*(0) vs MI, 2 May 2019)
  IS counted as an innings + not out. This matches the web-verified 2013/2014
  data (e.g. Ishant Sharma 2013: 0 balls faced, 2 innings, 2 not outs).
  A 2019/2020 researcher's striker-only count was 1 lower for 7 tail-enders;
  the scorecard convention is used in the CSV.
- A 2017/2018 researcher's innings counts for three players were rejected
  after ball-by-ball + independent verification (DNB games had been counted
  as innings): Naman Ojha 2017 is 5 innings/1 not-out (t20cricstats: I=5/NO=1;
  advancecricket.in lists his single 2017 not-out innings, 11* vs KKR;
  cricsheet: 5/1) not 14/10; Ben Cutting 2017 is 3/1 (DNB vs KXIP 9 Apr 2017)
  not 4/2; Yuvraj Singh 2017 is 11/2 (DNB vs KXIP 9 Apr 2017) not 12/3.
  Runs/averages/SRs are identical either way.
- Strike rate is left EMPTY (not 0.00) when a player faced 0 balls (undefined).
  Affected: Ishant Sharma 2013, Parvez Rasool 2014. Batting average is empty
  when never dismissed (standard).
- Rounding is half-up to 2 decimals (Python banker's rounding NOT used),
  computed with exact decimal arithmetic (e.g. economy = runs*6/balls as an
  exact fraction, avoiding float error at .xx5 boundaries).
  E.g. Jonny Bairstow 2019 avg = 445/8 = 55.63 (not 55.62);
  Eshan Malinga 2025 econ = 238*6/160 = 8.93 (not 8.92).
  Note: some websites TRUNCATE rather than round x.xx5 cases (e.g. Harshal
  Patel 2025 avg shown as 26.87 in some places vs correctly-rounded 26.88;
  myKhel shows Markram 2022 avg 47.62 / Abhishek 2022 SR 133.12 truncated vs
  47.63 / 133.13 rounded); raw inputs (runs, wickets, overs) are undisputed.
- Cricsheet short names resolved via the Cricsheet people registry:
  "AU Rashid" = Adil Rashid (SRH 2023); "PA Reddy" = Akshath Reddy (SRH 2013);
  "X Thalaivan Sargunam" = Thalaivan Sargunam; "R Smaran" = Smaran
  Ravichandran; "PP Hinge" = Praful Hinge; "S Arora"+"Salil Arora" merged
  (same registry id); ESPNcricinfo spellings used ("Nitish Kumar Reddy",
  "Venugopal Rao", "T Natarajan", "KL Rahul").
