# BLS Producer Price Index → Costbook ingestion

## Purpose

TradeOS uses selected U.S. Bureau of Labor Statistics Producer Price Index (PPI) series as **price-trend evidence** for Costbook intelligence. PPI observations are indexes, not dollar prices.

Source root: `https://download.bls.gov/pub/time.series/pc/`

As of 2026-09-12, the BLS PPI bulk directory was refreshed on 2026-09-10.

## Initial vetted series

| Costbook category | BLS series | Source file | Intended use |
| --- | --- | --- | --- |
| Wood | `PCU321---321---` | `pc.data.10.Wood` | lumber/framing/millwork escalation |
| Plastics & rubber | `PCU326---326---` | `pc.data.15.PlasticsRubberProducts` | PVC/plastic/rubber/pipe trend evidence |
| Nonmetallic mineral products | `PCU327---327---` | `pc.data.16.NonmetallicMineral` | concrete/cement/brick/block/gypsum/glass trend evidence |
| Primary metals | `PCU331---331---` | `pc.data.17.PrimaryMetal` | steel/aluminum/copper/metal trend evidence |
| Electrical equipment | `PCU335---335---` | `pc.data.21.ElectricalMachinery` | electrical equipment/panels/transformers/HVAC equipment trends |
| Utilities | `PCU221---221---` | `pc.data.46.Utilities` | operating-energy trend evidence |

## Semantic boundary

PPI must **never** be written into `materialCostTypical`, a supplier price, a customer price, or a bill rate. It is only a relative index.

Permitted uses include:

- month-over-month and year-over-year trend calculations;
- staleness detection for previously verified Costbook prices;
- escalation factors between two dated index observations;
- human-review recommendations that a Costbook price may need refreshed.

For two valid index observations, TradeOS may calculate:

`escalationFactor = newerIndex / olderIndex`

A previously verified local price may then be shown to a reviewer with a **suggested** escalated value, but no autonomous Costbook write or historical repricing is allowed.

## Ingestion

Run:

```bash
python3 scripts/ingest-bls-ppi.py
```

The script fetches only the vetted series, excludes `M13` annual-average rows, preserves monthly observations and footnote codes, and writes:

`app/data/bls-ppi-costbook.json`

The generated snapshot records source URL, generation timestamp, series metadata, Costbook tags, and all monthly observations.

## Governance

This lane is read-only intelligence. Any future workflow that turns an index movement into a proposed Costbook dollar change must flow through the existing research-candidate / named-human-review / explicit-promotion boundary. Athena must not autonomously mutate Costbook pricing from PPI movements.
