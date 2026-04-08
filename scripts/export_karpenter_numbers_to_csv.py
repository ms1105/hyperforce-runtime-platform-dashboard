#!/usr/bin/env python3
"""
Export Apple Numbers "Karpenter Full" workbooks from Bin-packing Overall/ to CSV
filenames expected by fkp-dashboard.js (KARPENTER_FULL_FILES + Bin-packing Overall/).

Requires: pip install numbers-parser

Usage (from repo root):
  python3 scripts/export_karpenter_numbers_to_csv.py
"""
from __future__ import annotations

import csv
import os
import sys

try:
    from numbers_parser import Document
except ImportError:
    print("Install: pip install numbers-parser", file=sys.stderr)
    sys.exit(1)

# (source .numbers filename, dashboard CSV filename) — must match KARPENTER_FULL_FILES in fkp-dashboard.js
EXPORT_MAP = [
    ("April 2025 Karpenter Full.numbers", "2025 April Karpenter Full File.csv"),
    ("May 2025 Karpenter Full.numbers", "2025 May Karpenter Full File.csv"),
    ("June 2025 Karpenter Full.numbers", "2025 June Full Karpenter File.csv"),
    ("July 2025 Karpenter Full.numbers", "2025 July Full Karpenter file.csv"),
    ("August 2025 Karpenter Full.numbers", "2025 August Full Karpenter file.csv"),
    ("Sep 2025 Karpenter Full.numbers", "2025 Sep Full Karpenter File.csv"),
    ("Oct 2025 Karpenter Full.numbers", "2025 Oct Full Karpenter File.csv"),
    ("Nov 2025 Karpenter Full.numbers", "2025 Nov Full Karpenter File.csv"),
    ("Dec 2025 Karpenter Full.numbers", "2025 Dec Full Karpenter File.csv"),
    ("Jan 2026 Karpenter Full.numbers", "2026 Jan Full Karpenter File.csv"),
    ("Feb 2026 Karpenter Full.numbers", "2026 Feb Full Karpenter file.csv"),
    ("Mar 2026 Karpenter Full.numbers", "2026 March Full Karpenter File.csv"),
]

HEADER = [
    "report_date",
    "environment_type",
    "falcon_instance",
    "functional_domain",
    "k8s_cluster",
    "karpenter_status",
    "cpu_packing_percent",
]


def is_gcp_falcon_instance(fi: str) -> bool:
    """Exclude GCP FIs from exported CSVs (dashboard is AWS-scope bin-packing)."""
    s = (fi or "").strip().lower()
    if not s or s == "falcon_instance":
        return False
    return s.startswith("gcp") or "gcp-" in s


def export_one(numbers_path: str, csv_path: str) -> tuple[int, str]:
    doc = Document(numbers_path)
    table = doc.sheets[0].tables[0]
    nrows, ncols = table.num_rows, table.num_cols
    skipped_gcp = 0
    written = 0
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        for r in range(nrows):
            row = []
            for c in range(ncols):
                cell = table.cell(r, c)
                v = cell.value
                if isinstance(v, float):
                    row.append(v)
                elif v is None:
                    row.append("")
                else:
                    row.append(str(v).strip())
            if len(row) > 2 and is_gcp_falcon_instance(str(row[2])):
                skipped_gcp += 1
                continue
            w.writerow(row)
            written += 1
    if skipped_gcp:
        print("  ", os.path.basename(csv_path), "skipped GCP rows:", skipped_gcp)
    return written, csv_path


def main() -> int:
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src_dir = os.path.join(repo_root, "Bin-packing Overall")
    if not os.path.isdir(src_dir):
        print("Missing folder:", src_dir, file=sys.stderr)
        return 1

    ok = 0
    skipped = 0
    for src_name, out_name in EXPORT_MAP:
        src = os.path.join(src_dir, src_name)
        out = os.path.join(src_dir, out_name)
        if not os.path.isfile(src):
            print("skip (no source):", src_name)
            skipped += 1
            continue
        n, path = export_one(src, out)
        print("wrote", out_name, "rows=", n)
        ok += 1

    print("done:", ok, "exported,", skipped, "skipped (add .numbers to match EXPORT_MAP)")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
