import requests, json, time

TEXTS = [
    'large scale ping flood against web server',
    'unauthorized sql query exfiltrated user emails',
    'ransomware executable detected in temp folder',
    'phishing link impersonating payroll portal',
    'legitimate penetration test flagged by siem',
    'brute force ssh login attempts from russia',
    'account takeover via credential stuffing',
    'malicious macro in office document',
    'social engineering call pretending to be IT',
    'unencrypted backup disk lost in transit',
    'dns amplification attack from open resolvers',
    'internal security audit traffic marked suspicious',
]

BASE = 'http://127.0.0.1:10086/command'

def cmd(action, args):
    r = requests.post(BASE, json={'action': action, 'args': args, 'session': 'm7'}, timeout=30)
    return r.json()

# ensure on dashboard
print('navigate')
cmd('navigate', {'url': 'http://localhost:4173/#/dashboard'})
time.sleep(2)

for i, text in enumerate(TEXTS, 1):
    print(f'classify {i}: {text[:50]}...')
    code = """
(() => {
  const ta = document.querySelector('textarea[aria-label="Ticket text"]');
  if (!ta) return 'no textarea';
  ta.scrollIntoView({block: 'center'});
  ta.value = %s;
  ta.dispatchEvent(new Event('input', {bubbles: true}));
  const buttons = Array.from(document.querySelectorAll('#live-prediction button[type="button"]'));
  const btn = buttons.find(b => b.textContent.includes('Classify Ticket'));
  if (!btn) return 'no classify button';
  btn.scrollIntoView({block: 'center'});
  btn.click();
  return 'clicked';
})()
""" % json.dumps(text)
    res = cmd('evaluate', {'code': code})
    print('  ->', res.get('data', {}).get('value'))
    time.sleep(2.5)

print('done')
