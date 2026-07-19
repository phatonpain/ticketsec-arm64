import json
import time
import urllib.request
from pathlib import Path

URL = 'http://127.0.0.1:10086/command'
SESSION = 'ticketsec-m6-axe'
ROOT = Path('D:/ComfyUI/ticketsec-arm64-dashboard')
OUT_DIR = ROOT / 'axe-results-m6'
OUT_DIR.mkdir(parents=True, exist_ok=True)

VIEWS = [
    ('dashboard', 'Dashboard'),
    ('detections', 'Detections'),
    ('predictions', 'Live Predictions'),
    ('threat-analytics', 'Threat Analytics'),
    ('model-registry', 'Model Registry'),
    ('system-health', 'System Health'),
]


def send(action, args):
    payload = {'action': action, 'args': args, 'session': SESSION}
    req = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {'error': str(e)}


def run_axe():
    axe_code = r"""
    (async () => {
      const existing = document.getElementById('axe-core-injected');
      if (!existing) {
        const script = document.createElement('script');
        script.id = 'axe-core-injected';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
        document.head.appendChild(script);
        await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
      }
      const results = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }
      });
      return JSON.stringify(results);
    })()
    """
    resp = send('evaluate', {'code': axe_code})
    raw = resp.get('data', {}).get('value')
    if not raw:
        return None
    return json.loads(raw)


def app_violations(results):
    out = []
    for v in results.get('violations', []):
        nodes = [n for n in v['nodes'] if not any('chatgpt-sidebar' in str(t) for t in n.get('target', []))]
        if nodes:
            out.append({**v, 'nodes': nodes})
    return out


def main():
    send('close_session', {})
    send('navigate', {'url': 'http://localhost:4173', 'newTab': True, 'group_title': 'TicketSec M6 Axe'})
    time.sleep(2)

    summary = {}
    for slug, label in VIEWS:
        send('evaluate', {'code': f'window.location.hash = "#/{slug}"; "ok"'})
        time.sleep(1.5)
        results = run_axe()
        if results is None:
            print(f'{label}: axe failed')
            continue
        (OUT_DIR / f'{slug}.json').write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf-8')
        app = app_violations(results)
        summary[label] = len(app)
        print(f'{label}: {len(results.get("violations", []))} raw violations, {len(app)} app violations')
        for v in app:
            for n in v['nodes']:
                print(f"  - {v['id']}: {n.get('html', '')[:120]}")

    send('close_session', {})
    total = sum(summary.values())
    print(f'\nTotal app violations across all views: {total}')


if __name__ == '__main__':
    main()
