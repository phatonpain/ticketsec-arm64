import urllib.request
import json
import time

url = 'http://127.0.0.1:10086/command'
session = 'ticketsec-dashboard'

def send(action, args):
    payload = {'action': action, 'args': args, 'session': session}
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'Content-Type':'application/json'}, method='POST')
    return urllib.request.urlopen(req).read().decode()

print(send('navigate', {'url': 'http://localhost:5173', 'newTab': True, 'group_title': 'TicketSec React Dashboard'}))
time.sleep(3)
print(send('screenshot', {'path': 'C:/Users/crust/Downloads/ticketsec-react-preview.png'}))
