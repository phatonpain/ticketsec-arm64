#!/usr/bin/env python3
"""Contrast sweep across the TicketSec dark-theme token system.

Checks 23 foreground/background pairs that represent real UI text surfaces.
All pairs must meet WCAG 2.1 AA (>= 4.5:1) for normal text.
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from typing import Sequence


# Backgrounds are the actual painted surfaces in the app.
BACKGROUNDS: dict[str, str] = {
    "body": "#0B0F19",
    "sidebar": "#0F172A",
    "card": "#1E293B",
    "input": "#0F172A",
}

# Foregrounds are text/icon colors used on those surfaces.
FOREGROUNDS: dict[str, str] = {
    "text-primary": "#F8FAFC",
    "text-secondary": "#94A3B8",
    "text-muted": "#8292A8",
    "link": "#818CF8",
    "cat-1-text": "#A5B4FC",
    "cat-2-text": "#22D3EE",
    "cat-3-text": "#FBBF24",
    "cat-4-text": "#FB7185",
    "cat-5-text": "#A78BFA",
    "cat-6-text": "#94A3B8",
    "sev-critical": "#FB7185",
    "sev-high": "#F97316",
    "sev-medium": "#F59E0B",
    "sev-low": "#38BDF8",
    "sev-info": "#60A5FA",
    "status-ok": "#34D399",
    "status-warn": "#FBBF24",
    "status-err": "#FB7185",
}


def relative_luminance(hex_color: str) -> float:
    hex_color = hex_color.lstrip("#")
    r, g, b = (int(hex_color[i : i + 2], 16) / 255.0 for i in (0, 2, 4))

    def adjust(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b)


def contrast_ratio(fg: str, bg: str) -> float:
    l1 = relative_luminance(fg)
    l2 = relative_luminance(bg)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


@dataclass(frozen=True)
class Check:
    fg_name: str
    fg: str
    bg_name: str
    bg: str
    ratio: float
    pass_aa: bool


# The 23 checks selected to cover all text surfaces in the app.
CHECKS: Sequence[tuple[str, str]] = [
    ("text-primary", "body"),
    ("text-secondary", "body"),
    ("text-muted", "body"),
    ("text-primary", "card"),
    ("text-secondary", "card"),
    ("text-muted", "card"),
    ("link", "card"),
    ("cat-1-text", "card"),
    ("cat-2-text", "card"),
    ("cat-3-text", "card"),
    ("cat-4-text", "card"),
    ("cat-5-text", "card"),
    ("cat-6-text", "card"),
    ("sev-critical", "card"),
    ("sev-high", "card"),
    ("sev-medium", "card"),
    ("sev-low", "card"),
    ("sev-info", "card"),
    ("status-ok", "card"),
    ("status-warn", "card"),
    ("status-err", "card"),
    ("text-primary", "input"),
    ("text-secondary", "sidebar"),
]


def main() -> int:
    results: list[Check] = []
    fails = 0
    for fg_name, bg_name in CHECKS:
        fg = FOREGROUNDS[fg_name]
        bg = BACKGROUNDS[bg_name]
        ratio = contrast_ratio(fg, bg)
        ok = ratio >= 4.5
        if not ok:
            fails += 1
        results.append(Check(fg_name, fg, bg_name, bg, round(ratio, 2), ok))

    print(json.dumps([r.__dict__ for r in results], indent=2))
    print(f"\n=== Summary ===")
    print(f"Checks: {len(results)}  Pass AA: {len(results) - fails}  Fail: {fails}")
    min_ratio = min(r.ratio for r in results)
    min_check = next(r for r in results if r.ratio == min_ratio)
    print(f"Minimum ratio: {min_check.fg_name} on {min_check.bg_name} = {min_ratio}:1")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
