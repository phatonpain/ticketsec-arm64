"""Minimal mock API server for testing the live branch of TicketSec dashboard.

Run with:
    python mock_server.py

Then start the dashboard with:
    $env:VITE_API_BASE_URL="http://127.0.0.1:8000"; npm run dev
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import random

PORT = 8000

PERFORMANCE_HISTORY = [
    {"time": "12:00", "baseline": 88.5, "onnx": 98.2, "int8": 97.4, "latency_ms": 2.1, "throughput": 1240},
    {"time": "13:00", "baseline": 89.1, "onnx": 98.4, "int8": 97.6, "latency_ms": 2.0, "throughput": 1310},
    {"time": "14:00", "baseline": 87.9, "onnx": 98.1, "int8": 97.3, "latency_ms": 2.3, "throughput": 1180},
    {"time": "15:00", "baseline": 88.7, "onnx": 98.5, "int8": 97.7, "latency_ms": 1.9, "throughput": 1420},
    {"time": "16:00", "baseline": 89.3, "onnx": 98.3, "int8": 97.5, "latency_ms": 2.2, "throughput": 1290},
    {"time": "17:00", "baseline": 88.2, "onnx": 98.6, "int8": 97.8, "latency_ms": 1.8, "throughput": 1510},
]

CLASSIFICATIONS = [
    {"id": "TKT-8501", "subject": "Live phishing campaign detected", "category": "Phishing", "confidence": 0.97, "status": "Resolved", "assignedTo": "Auto", "createdAt": "2026-07-17T10:05:00Z"},
    {"id": "TKT-8502", "subject": "Live malware sample submitted", "category": "Malware", "confidence": 0.94, "status": "Escalated", "assignedTo": "Security Team", "createdAt": "2026-07-17T10:08:00Z"},
    {"id": "TKT-8503", "subject": "Suspicious data export attempt", "category": "Data Breach", "confidence": 0.89, "status": "Pending", "assignedTo": "Security Team", "createdAt": "2026-07-17T10:12:00Z"},
    {"id": "TKT-8504", "subject": "Unauthorized admin login", "category": "Unauthorized Access", "confidence": 0.86, "status": "Escalated", "assignedTo": "NOC", "createdAt": "2026-07-17T10:15:00Z"},
    {"id": "TKT-8505", "subject": "DDoS alert from edge", "category": "DDoS", "confidence": 0.81, "status": "Pending", "assignedTo": "NOC", "createdAt": "2026-07-17T10:18:00Z"},
    {"id": "TKT-8506", "subject": "False positive on vulnerability scan", "category": "False Positive", "confidence": 0.73, "status": "Resolved", "assignedTo": "Auto", "createdAt": "2026-07-17T10:22:00Z"},
]

CATEGORIES = [
    {"category": "Phishing", "count": 1847},
    {"category": "Malware", "count": 1245},
    {"category": "Data Breach", "count": 634},
    {"category": "Unauthorized Access", "count": 982},
    {"category": "DDoS", "count": 412},
    {"category": "False Positive", "count": 156},
]

CATEGORIES_MAP = {c["category"]: c["count"] for c in CATEGORIES}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json({})

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/health", "/", "/docs"):
            self._send_json({"status": "ok"})
        elif path == "/api/v1/performance/history":
            self._send_json(PERFORMANCE_HISTORY)
        elif path == "/api/v1/classifications":
            self._send_json(CLASSIFICATIONS)
        elif path == "/api/v1/stats/categories":
            self._send_json(CATEGORIES)
        else:
            self._send_json({"detail": "Not found"}, 404)

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/predict":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode()
            try:
                payload = json.loads(body) if body else {}
                text = payload.get("text", "")
            except Exception:
                text = ""
            category = random.choice(list(CATEGORIES_MAP.keys()))
            self._send_json({
                "predicted_category": category,
                "confidence": round(0.70 + random.random() * 0.28, 3),
                "processing_time_ms": round(1.5 + random.random() * 2, 2),
                "probabilities": {cat: round(random.random(), 3) for cat in CATEGORIES_MAP},
            })
        else:
            self._send_json({"detail": "Not found"}, 404)


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Mock API listening on http://127.0.0.1:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
