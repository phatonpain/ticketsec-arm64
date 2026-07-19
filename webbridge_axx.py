import urllib.request
import json
import time

URL = 'http://127.0.0.1:10086/command'
SESSION = 'ticketsec-phase-e'


def send(action, args):
    payload = {'action': action, 'args': args, 'session': SESSION}
    req = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    return json.loads(urllib.request.urlopen(req).read().decode())


close = send('close_session', {})
print('close_session:', close)
nav = send('navigate', {'url': 'http://localhost:4173', 'newTab': True, 'group_title': 'TicketSec Phase E'})
print('navigate:', nav)
time.sleep(3)
axe_code = r"""
(async () => {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
  document.head.appendChild(script);
  await new Promise((resolve) => script.onload = resolve);
  const results = await axe.run(document, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']
    }
  });
  return JSON.stringify(results);
})()
"""
eval_resp = send('evaluate', {'code': axe_code})
raw = eval_resp['data']['value']
results = json.loads(raw)
with open('axe-results.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
violations = results.get('violations', [])
print(f"violations: {len(violations)}")
for v in violations:
    print(f"- {v['id']}: {v['impact']} ({len(v['nodes'])} nodes) - {v['description']}")
