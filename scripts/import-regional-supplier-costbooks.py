#!/usr/bin/env python3
"""Post staged regional supplier evidence batches to TradeOS.

The operator must provide tenant-local Supplier IDs explicitly. This script
never discovers suppliers across tenants, changes Material.unitCost, or
creates SupplierPriceUpdate rows.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
ENDPOINT = "/costbook/supplier-evidence/import"


class NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def validate_api_base(api_base: str) -> str:
    parsed = urlparse(api_base)
    is_loopback = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme != "https" and not (parsed.scheme == "http" and is_loopback):
        raise ValueError("--api-base must use HTTPS unless it targets an explicit loopback host")
    if not parsed.netloc:
        raise ValueError("--api-base must include a host")
    return api_base.rstrip("/")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def parse_supplier_map(path: Path) -> dict[str, str]:
    raw = load_json(path)
    if not isinstance(raw, dict) or not raw:
        raise ValueError("Supplier map must be a non-empty JSON object: {SUPPLIER_CODE: supplier_uuid}")
    result = {}
    for code, supplier_id in raw.items():
        if not isinstance(code, str) or not isinstance(supplier_id, str) or not UUID_RE.fullmatch(supplier_id):
            raise ValueError(f"Invalid supplier map entry for {code!r}; values must be UUIDs")
        result[code] = supplier_id
    return result


def post_batch(api_base: str, token: str, batch: dict, supplier_id: str, timeout: float) -> dict:
    api_base = validate_api_base(api_base)
    body = {
        "supplierId": supplier_id,
        "sourceFile": batch.get("sourceFile"),
        "products": batch["products"],
        "observations": batch["observations"],
    }
    request = Request(
        api_base + ENDPOINT,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    opener = build_opener(NoRedirectHandler())
    with opener.open(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="JSON produced by parse-regional-supplier-costbooks.py")
    parser.add_argument("--supplier-map", type=Path, required=True, help="JSON mapping supplier_code to tenant-local Supplier UUID")
    parser.add_argument("--api-base", default=os.environ.get("TRADEOS_API_BASE", "http://localhost:4000/api/v1"))
    parser.add_argument("--token", default=os.environ.get("TRADEOS_ACCESS_TOKEN"), help="Bearer token; defaults to TRADEOS_ACCESS_TOKEN")
    parser.add_argument("--only-supplier-code", help="Import one supplier code from the staged bundle")
    parser.add_argument("--timeout", type=float, default=60.0)
    parser.add_argument("--dry-run", action="store_true", help="Validate mapping and print counts without making requests")
    parser.add_argument("--continue-on-error", action="store_true")
    args = parser.parse_args()

    staged = load_json(args.input)
    batches = staged.get("batches") if isinstance(staged, dict) else None
    if not isinstance(batches, list) or not batches:
        raise ValueError("Input JSON must contain a non-empty batches array")
    supplier_map = parse_supplier_map(args.supplier_map)
    if not args.dry_run and not args.token:
        raise ValueError("--token or TRADEOS_ACCESS_TOKEN is required unless --dry-run is used")

    selected = [batch for batch in batches if not args.only_supplier_code or batch.get("supplierCode") == args.only_supplier_code]
    if not selected:
        raise ValueError("No staged batch matched --only-supplier-code")

    failures = 0
    for batch in selected:
        code = batch.get("supplierCode")
        if code not in supplier_map:
            raise ValueError(f"No tenant Supplier UUID supplied for {code}")
        supplier_id = supplier_map[code]
        products = batch.get("products", [])
        observations = batch.get("observations", [])
        unavailable = sum(row.get("priceStatus") == "unavailable" for row in observations)
        summary = f"{code}: {len(products)} products, {len(observations)} observations, {unavailable} unavailable"
        if args.dry_run:
            print(f"[dry-run] {summary} -> supplier {supplier_id}")
            continue
        try:
            result = post_batch(args.api_base, args.token, batch, supplier_id, args.timeout)
            print(f"[imported] {summary}: {json.dumps(result, separators=(",", ":"))}")
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            failures += 1
            print(f"[failed] {summary}: {exc}", file=sys.stderr)
            if not args.continue_on_error:
                return 1

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
