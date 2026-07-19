import requests

texts=[
'large scale ping flood against web server',
'unauthorized sql query exfiltrated user emails',
'ransomware executable detected in temp folder',
'phishing link impersonating payroll portal',
'legitimate penetration test flagged by siem',
'brute force ssh login attempts from russia'
]
for t in texts:
    r=requests.post('http://3.23.60.61:8000/predict', json={'text':t}, timeout=15)
    d=r.json()
    print(f'{t} => {d["predicted_category"]} ({d["confidence"]})')
