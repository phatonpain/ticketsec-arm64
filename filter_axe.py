import json

with open('axe-results.json', encoding='utf-8') as f:
    data = json.load(f)


def is_app_node(node):
    target = node.get('target', [])
    # target may be string or list of strings/lists
    flat = json.dumps(target)
    return 'chatgpt-sidebar' not in flat


filtered = []
for rule in data.get('violations', []):
    nodes = [n for n in rule.get('nodes', []) if is_app_node(n)]
    if nodes:
        filtered.append({**rule, 'nodes': nodes})

print(f"App violations: {len(filtered)}")
for rule in filtered:
    print(f"- {rule['id']}: {rule['impact']} ({len(rule['nodes'])} nodes)")

out = {
    'testEngine': data.get('testEngine'),
    'testEnvironment': data.get('testEnvironment'),
    'timestamp': data.get('timestamp'),
    'url': data.get('url'),
    'app_violations': filtered,
    'raw_violations_count': len(data.get('violations', [])),
    'excluded_targets': ['chatgpt-sidebar'],
}
with open('axe-results-app.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
