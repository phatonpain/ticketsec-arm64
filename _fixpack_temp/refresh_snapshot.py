import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API_URL = "http://127.0.0.1:8000"
SNAPSHOT_FILE = Path("public/cache/tickets-snapshot.json")
LOG_FILE = Path("ops/logs/verification.log")

samples = [
    "suspicious email asking for bank credentials",
    "trojan horse detected in downloaded file",
    "multiple failed login attempts from unknown IP",
    "customer database export without approval",
    "DDoS attack pattern detected on edge router",
    "routine vulnerability scan flagged as incident",
]

status_pool = ["Resolved", "Escalated", "Pending"]
assigned_pool = ["Auto", "Security Team", "NOC"]

rows = []
for i, text in enumerate(samples):
    req = urllib.request.Request(
        f"{API_URL}/predict",
        data=json.dumps({"text": text}).encode(),
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req, timeout=10).read().decode()
    data = json.loads(resp)
    category = data.get("predicted_category", "Unknown")
    confidence = data.get("confidence", 0)
    rows.append(
        {
            "id": f"TKT-{8501 + i}",
            "subject": text,
            "category": category,
            "confidence": confidence,
            "status": status_pool[i % 3],
            "assignedTo": assigned_pool[i % 3],
            "minutesAgo": (i + 1) * 3,
        }
    )

SNAPSHOT_FILE.parent.mkdir(parents=True, exist_ok=True)
SNAPSHOT_FILE.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")

LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
LOG_FILE.write_text(f"{now} | snapshot-refresh | OK: refreshed from {API_URL}/predict\n", encoding="utf-8")
print("OK: snapshot refreshed")
for r in rows:
    print(f"  {r['id']}: {r['category']} ({r['confidence']:.4f})")
