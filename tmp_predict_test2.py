import requests

texts=[
'account takeover via credential stuffing',
'malicious macro in office document',
'social engineering call pretending to be IT',
'unencrypted backup disk lost in transit',
'dns amplification attack from open resolvers',
'internal security audit traffic marked suspicious'
]
for t in texts:
    r=requests.post('http://3.23.60.61:8000/predict', json={'text':t}, timeout=15)
    d=r.json()
    print(f'{t} => {d["predicted_category"]} ({d["confidence"]})')
