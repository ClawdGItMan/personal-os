# Personal OS — locked design system (turn 6 → 7)

Modes: LIGHT = 6b (Gallery/porcelain) · DARK = 6c (Ivy)

## LIGHT (6b)
- bg #F5F3ED (porcelain) · surfaces #FFFFFF · ink #0F1115
- ink dims rgba(15,17,21,.72/.64/.5/.38/.34/.28)
- hairlines: section rgba(15,17,21,.1) · col .07 · row .06
- accent evergreen #1E7A52 · deep #175E40
- focus/training band: borders rgba(30,122,82,.28); bg linear-gradient(180deg,rgba(30,122,82,.055),rgba(30,122,82,.02)); label+8.5px ls.2em #1E7A52; time ink #0F1115
- recovery band borders rgba(30,122,82,.24)
- dial: track rgba(15,17,21,.08), arc #1E7A52, dasharray 182.2 offset 51 (72%)
- HRV bars rgba(30,122,82,.35) + last #1E7A52; heights 14,17,12,19,16,21,26
- pips #1E7A52 / track rgba(15,17,21,.1); done squares #175E40; open dot border rgba(15,17,21,.28)
- day bar: track rgba(15,17,21,.08), fill rgba(15,17,21,.38), dot #0F1115; DAY 55% rgba(15,17,21,.5) (grey — no blue anywhere)
- times: done rgba(15,17,21,.34), upcoming rgba(15,17,21,.5) (always ink, never colored)
- state colors: green #1E7A52 · amber #A8842B (pips #B9973E) · red #B0472F
- tab bar: shadow 0 -1px 0 rgba(15,17,21,.1); tick #1E7A52; active icon #0F1115 label .72; inactive rgba(15,17,21,.38); capture #FFFFFF ring rgba(15,17,21,.12) + 0 6px 16px rgba(15,17,21,.1), icon #0F1115; indicator rgba(15,17,21,.28)
- status bar ink #0F1115, battery border rgba(15,17,21,.35)
- phone: 390w, r46, shadow 0 40px 90px -30px rgba(20,18,12,.4), ring rgba(23,21,15,.08)
- shimmer rgba(255,255,255,.65)

## DARK (6c)
- bg #0C0F0C · surfaces #141813 · ink #EFEDE2
- ink dims rgba(239,237,226,.72/.66/.55/.5/.34/.28)
- hairlines .12/.08/.07; tracks .09/.1/.13
- accent ivy #6CAB86 · deep #3A6B51
- focus band: borders rgba(108,171,134,.28); bg gradient rgba(108,171,134,.06)→(.025); label #6CAB86; time #6CAB86
- dial track rgba(239,237,226,.09); arc #6CAB86; HRV bars rgba(108,171,134,.36)+#6CAB86
- pips #6CAB86 / rgba(239,237,226,.13); done squares #3A6B51; open dot rgba(239,237,226,.28)
- day bar fill rgba(239,237,226,.45), dot #EFEDE2
- state colors: green #6CAB86 · amber #C9A45C · red #C86A5A
- tab: tick #6CAB86; capture #141813 ring rgba(239,237,226,.16) icon #EFEDE2; indicator .28
- phone shadow rgba(0,0,0,.82) ring rgba(239,237,226,.05); shimmer rgba(239,237,226,.5)

## State rules (both modes)
- sleep: >7h green · 6–7h amber · <6h red (7:12 → green)
- habits: >3/6 green · else amber (4/6 → green)
- net worth: positive green (incl. sub +0.03%) · negative red
- times/dates: always ink dims, never colored

## Structure (shared skeleton, from locked home)
- status bar 15px pad 15/30; header pad 24: MAX OS 10px ls.34em .5 + MA avatar 34 circle surface
- eyebrow 9.5px mono ls.24em .5 + right stat; 2px bar (home only)
- title block: 16px 600 + status 13px/1.5 .64-.66 (max-w 300)
- bands: full-bleed, padding ~15-19px 24px, border top/bottom hairline or accent-tint
- band title 21px 700 -.025em; band sub 9.5px mono ls.1em .5
- vitals grid 3-col: label 9px ls.18em .5 / value 20px 600 -.01em mt9 / sub 8.5px mt8
- ledger: grid 58px 1fr auto, gap12, pad 12px 0; time 11px; title 14px 500; tag 8.5px ls.12em .34; first row border .1(L)/.12(D), rest .06(L)/.07(D)
- tab bar: 48px tabs, capture 50px r14 mt-8, icons 20px stroke1.5, labels 7.5px ls.16em; icons = home/body-silhouette/dollar/lamp-desk (paths in canvas file)
- motion: fadeUp .6s cubic-bezier(.22,.7,.25,1) stagger .02/.07/.12/.21/.27/.33/.39; w55/w42 fills; arcFrom dial; growY bars .55+.06i; shimmer 3s inf 2s

## Sibling screen content (turn 5 body + turn 7 plans)
- BODY: eyebrow right WEEK 19; title Body + "Recovery's green — cleared for the push day, logged this morning."; dial band; TRAINING·DONE band (11:00 AM, "Push day — 4 PRs", 52 MIN · TONNAGE 12,480 LB); SLEEP band (10:58 PM → 6:10 AM, 7:12 30px + 87% QUALITY, stages bar deep(16.7%,darkest)/rem(25%)/core(flex,.32 tint) + legend DEEP 1:12 REM 1:48 CORE 4:12); vitals REST HR 48 (−2·7D) / HRV 64 (↑+6 VS AVG) / WEIGHT 182.4 (−0.6·30D); THIS WEEK · 4 SESSIONS: 7 blocks 22px r4 M✓T✓W–T✓F✓(ring,label .72)S–S–; tab BODY active
- MONEY: eyebrow right APR · 30D; title Money + "Net worth steady — runway 34 months."; NET WORTH hero band (label + $2.83M 30px green + sub "+$847 TODAY · +0.03% 30D" green + 30d sparkline right, drawPath); accounts 3-col CASH $412K / INVESTED $2.31M / DEBT −$104K red sub "−2.1%"→keep sub "AUTOPAY ON"?: subs: CASH "2.9 MO RUNWAY"? keep minimal: CASH $412K (14.6%)· INVESTED $2.31M (+1.2% 30D green) · DEBT −$104K (red, "MORTGAGE"); MAY BURN band: $8.4K of $12K, bar 70% fill green + right "$3.6K LEFT"; RECENT ledger: 11:42 AM Wire · Acme +$12,500 (green) WIRE / 9:15 AM Blue Bottle −$7.40 CARD / YDA Equinox −$210 CARD / YDA AWS −$1,842 ACH; tab MONEY active
- FOCUS: eyebrow right 3:12 TODAY; title Focus + "Two blocks left — protect the afternoon."; LIVE band w/ timer 44:12 (30px mono) + "DEEP WORK — PRICING MODEL" 14-21px + ENDS 3:00 PM + w42 progress+shimmer; stats 3-col SESSIONS 3/4 / DEEP HRS 3:12 (GOAL 4:00) / STREAK 12 (DAYS); QUEUE · 3 LEFT ledger: 3:00 PM Sequoia call CAL / 5:00 PM Review compliance checklist TASK / 7:00 PM Wind-down · journal HABIT; DEEP WORK · 7D band: 7 bars (growY) heights ~ 20,26,14,30,24,34,42 last accent + labels M-S; tab FOCUS active (lamp icon active)

Canvas: options grouped light+dark per screen in section t7 (7a Body, 7b Money, 7c Focus).
