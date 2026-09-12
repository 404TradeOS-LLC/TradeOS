#!/usr/bin/env python3
"""Ingest vetted BLS Producer Price Index series for Costbook intelligence.

PPI values are indexes, not dollar prices. This script only produces historical
index observations and category mappings for escalation/staleness analysis.
"""
from __future__ import annotations

import csv
import io
import json
import pathlib
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone

ROOT = "https://download.bls.gov/pub/time.series/pc"
OUTPUT = pathlib.Path("app/data/bls-ppi-costbook.json")


@dataclass(frozen=True)
class Series:
    category: str
    series_id: str
    label: str
    filename: str
    tags: tuple[str, ...]

    @property
    def source_url(self) -> str:
        return f"{ROOT}/{self.filename}"


SERIES = (
    Series("wood", "PCU321---321---", "Wood product manufacturing", "pc.data.10.Wood", ("lumber", "wood", "framing", "millwork")),
    Series("plastics-rubber", "PCU326---326---", "Plastics and rubber products manufacturing", "pc.data.15.PlasticsRubberProducts", ("pvc", "plastic", "rubber", "pipe", "insulation")),
    Series("nonmetallic-mineral", "PCU327---327---", "Nonmetallic mineral product manufacturing", "pc.data.16.NonmetallicMineral", ("concrete", "cement", "brick", "block", "gypsum", "glass")),
    Series("primary-metal", "PCU331---331---", "Primary metal manufacturing", "pc.data.17.PrimaryMetal", ("steel", "aluminum", "copper", "metal")),
    Series("electrical-machinery", "PCU335---335---", "Electrical equipment, appliance, and component manufacturing", "pc.data.21.ElectricalMachinery", ("electrical", "panel", "transformer", "wire-equipment", "hvac-equipment")),
    Series("utilities", "PCU221---221---", "Utilities", "pc.data.46.Utilities", ("electricity", "gas", "energy", "operating-cost")),
)


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "TradeOS-Costbook/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8")


def parse_series(text: str, definition: Series) -> list[dict]:
    observations: list[dict] = []
    reader = csv.DictReader(io.StringIO(text), delimiter="\t")
    for raw in reader:
        row = {str(key).strip(): (value or "").strip() for key, value in raw.items()}
        if row.get("series_id") != definition.series_id:
            continue
        period = row.get("period", "")
        if len(period) != 3 or not period.startswith("M") or period == "M13":
            continue
        month = int(period[1:])
        if not 1 <= month <= 12:
            continue
        observations.append({
            "year": int(row["year"]),
            "month": month,
            "value": float(row["value"]),
            "footnoteCodes": row.get("footnote_codes", ""),
        })
    observations.sort(key=lambda item: (item["year"], item["month"]))
    return observations


def main() -> None:
    generated_at = datetime.now(timezone.utc).isoformat()
    payload = {
        "schemaVersion": 1,
        "source": "U.S. Bureau of Labor Statistics Producer Price Index bulk data",
        "sourceRoot": ROOT,
        "generatedAt": generated_at,
        "semanticBoundary": "PPI values are index observations, not material dollar prices or customer bill rates.",
        "series": [],
    }

    for definition in SERIES:
        observations = parse_series(fetch_text(definition.source_url), definition)
        if not observations:
            raise RuntimeError(f"No monthly observations found for {definition.series_id}")
        payload["series"].append({
            "category": definition.category,
            "seriesId": definition.series_id,
            "label": definition.label,
            "sourceUrl": definition.source_url,
            "costbookTags": list(definition.tags),
            "observations": observations,
        })
        latest = observations[-1]
        print(f"{definition.series_id}: {len(observations)} months; latest {latest['year']}-{latest['month']:02d} = {latest['value']}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
