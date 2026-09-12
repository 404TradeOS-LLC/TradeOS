#!/usr/bin/env python3
"""Import the prepared INDOT 2019-2026 workbook into TradeOS composite benchmarks.

Reads `Costbook_Import` and `Price_History`, normalizes rows into the governed
composite benchmark API contract, de-duplicates by source/year/item, and posts
bounded idempotent batches to `/api/v1/costbook/benchmarks/composite/import`.

INDOT values are composite installed awarded-bid prices. This script never
writes Material, LaborRate, Equipment, CostItem, estimate, invoice, or bill-rate
records directly.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree as ET

NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

SOURCE_NAME = "Indiana Department of Transportation (INDOT)"
DEFAULT_GEOGRAPHY = "Indiana statewide awarded contracts"
DEFAULT_PRICE_BASIS = "Installed/composite awarded-bid pay-item price; not raw material-only price"
IMPORT_PATH = "/api/v1/costbook/benchmarks/composite/import"

HEADER_ALIASES = {
    "year": {"year", "source_year", "price_year"},
    "section": {"section", "section_code"},
    "item_code": {"item", "item_code", "pay_item", "pay_item_number", "item number"},
    "description": {"description", "description_as_published", "item_description", "name"},
    "unit": {"unit", "canonical_unit", "unit_of_measure", "uom"},
    "low_price": {"low price", "low_price", "low"},
    "high_price": {"high price", "high_price", "high"},
    "weighted_avg_price": {
        "wgt avg", "weighted avg", "weighted_average", "weighted_avg_price",
        "weighted average price", "weighted_average_price", "reference_price", "unit_cost",
    },
    "source_quantity": {
        "no items", "no_items", "quantity", "total_quantity", "source_quantity", "bid_count",
    },
    "total_extended": {"total", "total_extended", "extended_total", "total_bid_amount"},
    "geography": {"geography", "regional_basis"},
    "price_basis": {"price_basis", "basis"},
    "source_file": {"source_file", "file", "workbook"},
    "source_row": {"source_row", "row", "row_number"},
    "source_url": {"source_url", "url"},
    "catalog_status": {"catalog_status", "status", "current_catalog"},
    "review_status": {"review_status", "row_status"},
}


def normalize_header(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower().replace("-", "_")).replace("_", " ")


def column_index(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref or "")
    if not letters:
        return -1
    value = 0
    for char in letters.group(0):
        value = value * 26 + (ord(char) - 64)
    return value - 1


def shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return ["".join(t.text or "" for t in si.findall(".//a:t", NS)) for si in root.findall("a:si", NS)]


def sheet_targets(zf: zipfile.ZipFile) -> dict[str, str]:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall("r:Relationship", REL_NS)}
    result: dict[str, str] = {}
    for sheet in workbook.findall("a:sheets/a:sheet", NS):
        rel_id = sheet.attrib[f"{{{OFFICE_REL_NS}}}id"]
        target = rel_map[rel_id].lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        result[sheet.attrib["name"]] = target
    return result


def parse_cell(cell: ET.Element, strings: list[str]) -> Any:
    kind = cell.attrib.get("t")
    if kind == "inlineStr":
        return "".join(t.text or "" for t in cell.findall(".//a:t", NS))
    value = cell.find("a:v", NS)
    if value is None or value.text is None:
        return None
    raw = value.text
    if kind == "s":
        return strings[int(raw)]
    if kind in {"str", "e"}:
        return raw
    try:
        number = float(raw)
        return int(number) if number.is_integer() else number
    except ValueError:
        return raw


def read_sheet(zf: zipfile.ZipFile, target: str, strings: list[str]) -> list[list[Any]]:
    root = ET.fromstring(zf.read(target))
    rows: list[list[Any]] = []
    for row in root.findall("a:sheetData/a:row", NS):
        cells: dict[int, Any] = {}
        max_col = -1
        for cell in row.findall("a:c", NS):
            idx = column_index(cell.attrib.get("r", ""))
            if idx < 0:
                continue
            cells[idx] = parse_cell(cell, strings)
            max_col = max(max_col, idx)
        rows.append([cells.get(i) for i in range(max_col + 1)] if max_col >= 0 else [])
    return rows


def find_header(rows: list[list[Any]]) -> tuple[int, dict[str, int]]:
    for row_index, row in enumerate(rows[:50]):
        normalized = [normalize_header(value) for value in row]
        mapping: dict[str, int] = {}
        for canonical, aliases in HEADER_ALIASES.items():
            normalized_aliases = {normalize_header(alias) for alias in aliases}
            for idx, value in enumerate(normalized):
                if value in normalized_aliases:
                    mapping[canonical] = idx
                    break
        if {"item_code", "description", "unit", "weighted_avg_price"}.issubset(mapping):
            return row_index, mapping
    raise ValueError("Could not locate required INDOT prepared-workbook headers")


def get(row: list[Any], mapping: dict[str, int], key: str) -> Any:
    idx = mapping.get(key)
    return row[idx] if idx is not None and idx < len(row) else None


def number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        result = float(value)
    else:
        cleaned = str(value).replace("$", "").replace(",", "").strip()
        if not cleaned:
            return None
        result = float(cleaned)
    if not math.isfinite(result) or result < 0:
        raise ValueError(f"Invalid nonnegative numeric value: {value!r}")
    return result


def integer(value: Any) -> int | None:
    parsed = number(value)
    if parsed is None:
        return None
    if not parsed.is_integer():
        raise ValueError(f"Expected integer value, got {value!r}")
    return int(parsed)


def normalize_review_status(value: Any) -> str:
    text = str(value or "reference").strip().lower().replace("_", "-")
    aliases = {
        "candidate-review": "needs-review",
        "candidate review": "needs-review",
        "pending": "needs-review",
        "approved": "reviewed",
        "ready": "reference",
    }
    text = aliases.get(text, text)
    if text.startswith("review:"):
        return "needs-review"
    if text not in {"reference", "needs-review", "reviewed", "rejected"}:
        return "reference"
    return text


def normalize_row(
    row: list[Any],
    mapping: dict[str, int],
    default_source_file: str,
    fallback_row: int,
) -> dict[str, Any] | None:
    item_code = str(get(row, mapping, "item_code") or "").strip()
    description = str(get(row, mapping, "description") or "").strip()
    unit = str(get(row, mapping, "unit") or "").strip()
    if not item_code or not description or not unit:
        return None

    weighted = number(get(row, mapping, "weighted_avg_price"))
    if weighted is None:
        return None

    year = integer(get(row, mapping, "year"))
    if year is None:
        match = re.search(r"(20\d{2})", str(get(row, mapping, "source_file") or default_source_file))
        if not match:
            raise ValueError(f"Missing source year for item {item_code}")
        year = int(match.group(1))

    low = number(get(row, mapping, "low_price"))
    high = number(get(row, mapping, "high_price"))
    if low is not None and high is not None and low > high:
        raise ValueError(f"low > high for {year}/{item_code}")
    if low is not None and weighted < low:
        raise ValueError(f"weighted average < low for {year}/{item_code}")
    if high is not None and weighted > high:
        raise ValueError(f"weighted average > high for {year}/{item_code}")

    source_file = str(get(row, mapping, "source_file") or default_source_file).strip()
    source_row = integer(get(row, mapping, "source_row")) or fallback_row
    geography = str(get(row, mapping, "geography") or DEFAULT_GEOGRAPHY).strip()
    price_basis = str(get(row, mapping, "price_basis") or DEFAULT_PRICE_BASIS).strip()

    result: dict[str, Any] = {
        "sourceName": SOURCE_NAME,
        "sourceIdentifier": f"INDOT-{year}-{item_code}",
        "sourceYear": year,
        "sourceFile": source_file,
        "sourceRow": source_row,
        "section": str(get(row, mapping, "section") or "").strip() or None,
        "itemCode": item_code,
        "description": description,
        "unitOfMeasure": unit,
        "lowPrice": low,
        "weightedAvgPrice": weighted,
        "highPrice": high,
        "sourceQuantity": number(get(row, mapping, "source_quantity")),
        "totalExtended": number(get(row, mapping, "total_extended")),
        "geography": geography,
        "priceBasis": price_basis,
        "catalogStatus": str(get(row, mapping, "catalog_status") or "").strip() or None,
        "reviewStatus": normalize_review_status(get(row, mapping, "review_status")),
    }
    source_url = str(get(row, mapping, "source_url") or "").strip()
    if source_url:
        result["sourceUrl"] = source_url
    return {key: value for key, value in result.items() if value is not None}


def load_rows(path: Path) -> list[dict[str, Any]]:
    with zipfile.ZipFile(path) as zf:
        strings = shared_strings(zf)
        targets = sheet_targets(zf)
        missing = {"Costbook_Import", "Price_History"} - set(targets)
        if missing:
            raise ValueError(f"Prepared workbook missing required sheets: {', '.join(sorted(missing))}")

        deduped: dict[tuple[str, int, str], dict[str, Any]] = {}
        # Historical observations first; current Costbook_Import rows then win for
        # overlapping source/year/item keys because they carry current-catalog metadata.
        for sheet_name in ("Price_History", "Costbook_Import"):
            rows = read_sheet(zf, targets[sheet_name], strings)
            header_index, mapping = find_header(rows)
            for excel_row, row in enumerate(rows[header_index + 1 :], start=header_index + 2):
                normalized = normalize_row(row, mapping, path.name, excel_row)
                if normalized is None:
                    continue
                key = (normalized["sourceName"], normalized["sourceYear"], normalized["itemCode"])
                deduped[key] = normalized

    return sorted(deduped.values(), key=lambda r: (r["sourceYear"], r["itemCode"]))


def chunks(rows: list[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for start in range(0, len(rows), size):
        yield rows[start : start + size]


def post_batch(api_base: str, token: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    url = api_base.rstrip("/") + IMPORT_PATH
    payload = json.dumps({"rows": rows}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Prepared INDOT XLSX workbook")
    parser.add_argument("--api-base", help="TradeOS API base URL, e.g. https://api.404tradeos.com")
    parser.add_argument("--token", help="Authenticated owner/admin bearer token")
    parser.add_argument("--batch-size", type=int, default=500, choices=range(1, 1001), metavar="1..1000")
    parser.add_argument("--dry-run", action="store_true", help="Parse/validate only; do not send network requests")
    parser.add_argument("--json-out", type=Path, help="Optional normalized JSON output for inspection/evidence")
    args = parser.parse_args()

    rows = load_rows(args.input)
    if not rows:
        raise SystemExit("No importable INDOT rows found")

    years = sorted({row["sourceYear"] for row in rows})
    print(f"Validated {len(rows)} unique INDOT source/year/item benchmark rows for years {years}")

    if args.json_out:
        args.json_out.write_text(
            json.dumps({"rowCount": len(rows), "years": years, "rows": rows}, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Wrote normalized evidence: {args.json_out}")

    if args.dry_run:
        return 0
    if not args.api_base or not args.token:
        raise SystemExit("--api-base and --token are required unless --dry-run is used")

    total_received = total_upserted = batch_count = 0
    try:
        for batch_number, batch in enumerate(chunks(rows, args.batch_size), start=1):
            result = post_batch(args.api_base, args.token, batch)
            received = int(result.get("received", 0))
            upserted = int(result.get("upserted", 0))
            total_received += received
            total_upserted += upserted
            batch_count += 1
            print(f"Batch {batch_number}: received={received} upserted={upserted}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Import failed HTTP {exc.code}: {detail}") from exc

    print(f"Import complete: batches={batch_count} received={total_received} upserted={total_upserted}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
