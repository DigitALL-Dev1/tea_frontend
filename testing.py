#!/usr/bin/env python3
"""
UNGM latest tenders scraper
---------------------------
Fetches the most recently published procurement notices from
https://www.ungm.org/Public/Notice (newest first) and saves them to CSV.

Install once:
    pip install requests beautifulsoup4

Examples:
    python ungm_latest.py                       # top 10 exactly as the website shows them (soonest deadline first)
    python ungm_latest.py --sort published      # 10 newest published notices instead
    python ungm_latest.py --top 20              # top 20
    python ungm_latest.py --from 15-Nov-2026 --to 16-Nov-2026 --all   # every notice in a date range
    python ungm_latest.py --watch 30            # re-check every 30 min, flag only NEW notices
"""
import argparse
import csv
import json
import os
import re
import sys
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup

BASE = "https://www.ungm.org"
PAGE_URL = f"{BASE}/Public/Notice"
SEARCH_URL = f"{BASE}/Public/Notice/Search"
SEEN_FILE = "ungm_seen_ids.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}
FIELDS = ["notice_id", "published", "deadline", "organization", "type",
          "reference", "country", "title", "url"]


def new_session():
    """Open the notice page to get the anti-forgery cookie + token."""
    s = requests.Session()
    s.headers.update(HEADERS)
    r = s.get(PAGE_URL, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    tok = soup.find("input", {"name": "__RequestVerificationToken"})
    if not tok:
        sys.exit("Could not find the verification token on the UNGM page (site layout may have changed).")
    return s, tok["value"]


def search_page(s, token, page, size, pub_from="", pub_to="", active=True, sort="deadline"):
    if sort == "deadline":
        # Same as the website's default view: open notices, soonest deadline first
        sort_field, ascending = "Deadline", True
        deadline_from = "" if (pub_from or pub_to) else datetime.now().strftime("%d-%b-%Y")
    else:
        # Newest published first
        sort_field, ascending, deadline_from = "DatePublished", False, ""
    payload = {
        "PageIndex": page, "PageSize": size,
        "Title": "", "Description": "", "Reference": "",
        "PublishedFrom": pub_from, "PublishedTo": pub_to,
        "DeadlineFrom": deadline_from, "DeadlineTo": "",
        "Countries": [], "Agencies": [], "UNSPSCs": [], "NoticeTypes": [],
        "SortField": sort_field, "SortAscending": ascending,
        "isPicker": False, "IsSustainable": False, "IsActive": active,
        "NoticeDisplayType": None, "TypeOfCompetitions": [],
    }
    r = s.post(SEARCH_URL, data=json.dumps(payload), timeout=30, headers={
        "Content-Type": "application/json",
        "RequestVerificationToken": token,
        "X-Requested-With": "XMLHttpRequest",
        "Referer": PAGE_URL,
    })
    r.raise_for_status()
    return parse_rows(r.text)


def clean(t):
    return re.sub(r"\s+", " ", t or "").strip()


def parse_rows(html):
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for row in soup.select("div.tableRow.dataRow"):
        cells = row.find_all("div", attrs={"role": "cell"}, recursive=False)
        if len(cells) < 8:
            continue
        nid = row.get("data-noticeid", "")
        title_el = cells[1].select_one(".ungm-title")
        deadline_el = cells[2].find("span")  # first span = date; hidden span = days left
        out.append({
            "notice_id": nid,
            "published": clean(cells[3].get_text()),
            "deadline": clean(deadline_el.get_text() if deadline_el else cells[2].get_text()),
            "organization": clean(cells[4].get_text()),
            "type": clean(cells[5].get_text()),
            "reference": clean(cells[6].get_text()),
            "country": clean(cells[7].get_text()),
            "title": clean(title_el.get_text() if title_el else cells[1].get_text()),
            "url": f"{BASE}/Public/Notice/{nid}",
        })
    return out


def fetch(top=10, pub_from="", pub_to="", fetch_all=False, active=True, sort="deadline"):
    s, token = new_session()
    size = 15 if fetch_all else min(top, 50)
    results, page = [], 0
    while True:
        rows = search_page(s, token, page, size, pub_from, pub_to, active, sort)
        results.extend(rows)
        if not fetch_all or len(rows) < size:
            break
        page += 1
        time.sleep(1)  # be polite
    return results if fetch_all else results[:top]


def save_csv(rows, path):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)


def show(rows):
    for i, r in enumerate(rows, 1):
        print(f"{i:>3}. [{r['published']}] {r['organization']} | {r['type']} | {r['country']}")
        print(f"     {r['title']}")
        print(f"     Deadline: {r['deadline']} | Ref: {r['reference']}")
        print(f"     {r['url']}\n")


def load_seen():
    if os.path.exists(SEEN_FILE):
        with open(SEEN_FILE, encoding="utf-8") as f:
            return set(json.load(f))
    return set()


def save_seen(ids):
    with open(SEEN_FILE, "w", encoding="utf-8") as f:
        json.dump(sorted(ids), f)


def main():
    ap = argparse.ArgumentParser(description="Scrape latest UNGM tenders")
    ap.add_argument("--top", type=int, default=10, help="how many notices (default 10)")
    ap.add_argument("--sort", choices=["deadline", "published"], default="deadline",
                    help="deadline = same order as the website (default); published = newest first")
    ap.add_argument("--from", dest="pub_from", default="", help="published from, e.g. 15-Nov-2026")
    ap.add_argument("--to", dest="pub_to", default="", help="published to, e.g. 16-Nov-2026")
    ap.add_argument("--all", action="store_true", help="fetch every page (use with --from/--to)")
    ap.add_argument("--include-closed", action="store_true", help="include notices past deadline")
    ap.add_argument("--out", default="ungm_latest.csv", help="CSV output path")
    ap.add_argument("--watch", type=int, default=0, help="repeat every N minutes, showing only new notices")
    a = ap.parse_args()

    seen = load_seen()
    while True:
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        try:
            rows = fetch(a.top, a.pub_from, a.pub_to, a.all, not a.include_closed, a.sort)
        except requests.RequestException as e:
            print(f"[{stamp}] Request failed: {e}")
            rows = None
        if rows is not None:
            save_csv(rows, a.out)
            new = [r for r in rows if r["notice_id"] not in seen]
            print(f"[{stamp}] {len(rows)} notices fetched, {len(new)} new -> {a.out}\n")
            show(new if (a.watch and seen) else rows)
            seen |= {r["notice_id"] for r in rows}
            save_seen(seen)
        if not a.watch:
            break
        time.sleep(a.watch * 60)


if __name__ == "__main__":
    main()