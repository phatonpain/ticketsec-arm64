import requests, time

BASE = 'http://127.0.0.1:10086/command'
SAMPLES = [
    'suspicious email asking for bank credentials',
    'trojan horse detected in downloaded file',
    'multiple failed login attempts from unknown IP',
]

def cmd(action, args):
    r = requests.post(BASE, json={'action': action, 'args': args, 'session': 'm7'}, timeout=30)
    return r.json()

cmd('navigate', {'url': 'http://localhost:4173/#/dashboard'})
time.sleep(2)

for r in range(5):
    for s in SAMPLES:
        code = f"""
(() => {{
  const btn = Array.from(document.querySelectorAll('#live-prediction button[type="button"]')).find(b => b.textContent.trim() === {repr(s)});
  if (!btn) return 'no chip';
  btn.scrollIntoView({{block:'center'}});
  btn.click();
  return 'clicked';
}})()
"""
        res = cmd('evaluate', {'code': code})
        print(r+1, s[:30], res.get('data', {}).get('value'))
        time.sleep(2.5)

print('done')
