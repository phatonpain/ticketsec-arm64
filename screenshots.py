import urllib.request
import json
import time
import os

URL = 'http://127.0.0.1:10086/command'
SESSION = 'ticketsec-screenshots'
OUT_DIR = r'D:\ComfyUI\ticketsec-arm64-dashboard\screenshots'


def send(action, args):
    payload = {'action': action, 'args': args, 'session': SESSION}
    req = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    return json.loads(urllib.request.urlopen(req).read().decode())


def screenshot(filename):
    send('evaluate', {'code': '(() => { const main = document.querySelector("main"); if (main) main.scrollTop = 0; window.scrollTo(0, 0); return "top"; })()'})
    time.sleep(0.5)
    path = os.path.join(OUT_DIR, filename)
    r = send('screenshot', {'path': path, 'format': 'png'})
    print(filename, r['data']['sizeBytes'])
    return r


def click_sidebar(title):
    code = f"""
    (() => {{
      const btn = document.querySelector('button[title="{title}"]');
      if (btn) {{ btn.click(); return 'clicked {title}'; }}
      return 'not found';
    }})()
    """
    print(send('evaluate', {'code': code}))
    time.sleep(1.5)


def keycombo(key, ctrl=False, meta=False):
    code = f"""
    (() => {{
      document.body.dispatchEvent(new KeyboardEvent('keydown', {{
        key: '{key}', bubbles: true, cancelable: true,
        ctrlKey: {'true' if ctrl else 'false'},
        metaKey: {'true' if meta else 'false'}
      }}));
      return 'dispatched {key}';
    }})()
    """
    send('evaluate', {'code': code})
    time.sleep(0.8)


print('close_session:', send('close_session', {}))
print('navigate:', send('navigate', {
    'url': 'http://localhost:4173/#/dashboard',
    'newTab': True,
    'group_title': 'TicketSec Screenshots'
}))
time.sleep(3)

screenshot('01-dashboard.png')

click_sidebar('Detections')
screenshot('02-detections.png')

click_sidebar('Live Predictions')
screenshot('03-live-predictions.png')

click_sidebar('Threat Analytics')
screenshot('04-threat-analytics.png')

click_sidebar('System Health')
screenshot('05-system-health.png')

click_sidebar('Model Registry')
screenshot('06-model-registry.png')

# Command Palette (Ctrl+K)
keycombo('k', ctrl=True)
screenshot('07-command-palette.png')

# Close palette by clicking backdrop
print(send('evaluate', {'code': """
(() => {
  const backdrop = document.querySelector('[role="presentation"]');
  if (backdrop) { backdrop.click(); return 'closed palette'; }
  return 'no backdrop';
})()
"""}))
time.sleep(0.5)

# Settings drawer
print(send('evaluate', {'code': """
(() => {
  const btn = document.querySelector('[data-testid="settings-button"], button[title="Settings"]');
  if (btn) { btn.click(); return 'clicked'; }
  return 'not found';
})()
"""}))
time.sleep(1)
screenshot('08-settings-drawer.png')

print('done')
