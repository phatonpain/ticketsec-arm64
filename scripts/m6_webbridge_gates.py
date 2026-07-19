import json
import time
import urllib.request
from pathlib import Path

URL = 'http://127.0.0.1:10086/command'
SESSION = 'ticketsec-m6'
ROOT = Path('D:/ComfyUI/ticketsec-arm64-dashboard')
SHOT_DIR = ROOT / 'screenshots' / 'm6'
SHOT_DIR.mkdir(parents=True, exist_ok=True)

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


def screenshot(name):
    path = str(SHOT_DIR / f'{name}.png')
    return send('screenshot', {'path': path, 'format': 'png'})


def navigate_hash(h):
    return send('evaluate', {'code': f'window.location.hash = "#/{h}"; "ok"'})


def run_axe():
    axe_code = r"""
    (async () => {
      const existing = document.getElementById('axe-core-injected');
      if (!existing) {
        const script = document.createElement('script');
        script.id = 'axe-core-injected';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
        document.head.appendChild(script);
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
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
        print('axe evaluate response:', resp)
        return None
    return json.loads(raw)


def main():
    print('Closing previous session...')
    print(send('close_session', {}))

    print('Navigating to preview server...')
    print(send('navigate', {'url': 'http://localhost:4173', 'newTab': True, 'group_title': 'TicketSec M6'}))
    time.sleep(2)

    for slug, label in VIEWS:
        print(f'Switching to {label} (#/{slug})...')
        print(navigate_hash(slug))
        time.sleep(1.5)
        shot = screenshot(slug)
        print(f'Screenshot {slug}:', shot.get('data', {}).get('path') or shot)

    print('Running axe-core on current page (System Health)...')
    axe_results = run_axe()
    if axe_results is not None:
        out = ROOT / 'axe-results-m6.json'
        out.write_text(json.dumps(axe_results, indent=2, ensure_ascii=False), encoding='utf-8')
        violations = axe_results.get('violations', [])
        print(f'Axe violations: {len(violations)}')
        for v in violations:
            print(f"- {v['id']}: {v['impact']} ({len(v['nodes'])} nodes) - {v['description']}")

    print('Closing session...')
    print(send('close_session', {}))


if __name__ == '__main__':
    main()
