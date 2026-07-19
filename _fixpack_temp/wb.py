import urllib.request
import json
import sys

def send(action, args=None, session='aws'):
    payload = json.dumps({'action': action, 'args': args or {}, 'session': session}).encode()
    req = urllib.request.Request('http://127.0.0.1:10086/command', data=payload, headers={'Content-Type': 'application/json'})
    resp = urllib.request.urlopen(req).read().decode()
    print(resp)

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'snapshot':
        send('snapshot')
    elif cmd == 'eval':
        code = sys.argv[2]
        send('evaluate', {'code': code})
    elif cmd == 'nav':
        send('navigate', {'url': sys.argv[2], 'newTab': True})
    else:
        print('unknown')
