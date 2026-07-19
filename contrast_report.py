import json

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(r, g, b):
    return f"#{r:02x}{g:02x}{b:02x}"

def parse_color(c):
    if c.startswith('#'):
        return hex_to_rgb(c)
    if c.startswith('rgba('):
        parts = c.strip('rgba()').split(',')
        return tuple(int(float(parts[i].strip())) for i in range(3)) + (float(parts[3].strip()),)
    raise ValueError(c)

def lum(c):
    def adj(x):
        return x/12.92 if x <= 0.03928 else ((x+0.055)/1.055)**2.4
    r, g, b = [v/255.0 for v in c[:3]]
    return 0.2126*adj(r) + 0.7152*adj(g) + 0.0722*adj(b)

def ratio(a, b):
    l1, l2 = lum(a), lum(b)
    return (max(l1,l2)+0.05)/(min(l1,l2)+0.05)

def blend(fg, bg):
    # fg may be rgba tuple length 4
    if len(fg) == 4:
        r, g, b, a = fg
        br, bgv, bb = bg
        out = tuple(int(a*c + (1-a)*bc) for c, bc in zip((r,g,b), (br,bgv,bb)))
        return out
    return fg

bg = {
    'body': '#0B0F19',
    'sidebar': '#0F172A',
    'card': '#1E293B',
    'input': '#0F172A',
    'elevated': '#27324A',
    'accent-indigo-strong': '#4F46E5',
}

combos = [
    ('text-primary', '#F8FAFC', 'body', False),
    ('text-primary', '#F8FAFC', 'card', False),
    ('text-secondary', '#94A3B8', 'body', False),
    ('text-secondary', '#94A3B8', 'card', False),
    ('text-muted', '#8292A8', 'body', False),
    ('text-muted', '#8292A8', 'card', False),
    ('link', '#818CF8', 'card', False),
    ('accent-indigo-strong + white', '#FFFFFF', 'accent-indigo-strong', True),
    ('badge-alert + white', '#FFFFFF', '#E11D48', True),
]

# Categorical text on tint over card
for i in range(1, 7):
    combos.append((f'cat-{i}-text on tint/card', None, f'cat-{i}', True))

# Status text on tint/card
for name, fg, tint in [
    ('status-ok', '#34D399', 'rgba(16,185,129,0.14)'),
    ('status-warn', '#FBBF24', 'rgba(245,158,11,0.14)'),
    ('status-err', '#FB7185', 'rgba(244,63,94,0.14)'),
]:
    combos.append((f'{name} text on tint/card', None, name, True))

# Severity colors as text on card (e.g., KPI delta)
for name, fg in [
    ('sev-critical', '#FB7185'),
    ('sev-high', '#F97316'),
    ('sev-medium', '#F59E0B'),
    ('sev-low', '#38BDF8'),
    ('sev-info', '#60A5FA'),
]:
    combos.append((f'{name} on card', fg, 'card', False))

token_sources = {
    'cat-1': ('#A5B4FC', 'rgba(99,102,241,0.16)'),
    'cat-2': ('#22D3EE', 'rgba(8,145,178,0.18)'),
    'cat-3': ('#FBBF24', 'rgba(217,119,6,0.18)'),
    'cat-4': ('#FB7185', 'rgba(225,29,72,0.18)'),
    'cat-5': ('#A78BFA', 'rgba(124,58,237,0.18)'),
    'cat-6': ('#94A3B8', 'rgba(100,116,139,0.18)'),
    'status-ok': ('#34D399', 'rgba(16,185,129,0.14)'),
    'status-warn': ('#FBBF24', 'rgba(245,158,11,0.14)'),
    'status-err': ('#FB7185', 'rgba(244,63,94,0.14)'),
}

results = []
for label, fg, bg_key, layered in combos:
    if fg is None:
        fg_hex, tint = token_sources[bg_key]
        fg_col = hex_to_rgb(fg_hex)
        effective = blend(parse_color(tint), hex_to_rgb(bg['card']))
    else:
        fg_col = hex_to_rgb(fg)
        if bg_key in bg:
            effective = hex_to_rgb(bg[bg_key])
        else:
            effective = hex_to_rgb(bg_key)
            layered = False
    r = ratio(fg_col, effective)
    results.append({
        'label': label,
        'fg': fg if fg else fg_hex,
        'effective_bg': rgb_to_hex(*effective),
        'ratio': round(r, 2),
        'pass_aa': r >= 4.5,
        'pass_aaa': r >= 7.0,
        'layered': layered,
    })

with open('contrast-report.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)

fails = [x for x in results if not x['pass_aa']]
print(f"Checked {len(results)} combos; AA fails: {len(fails)}")
for x in fails:
    print(f"FAIL {x['label']}: {x['ratio']}:1")
for x in results:
    print(f"{x['ratio']:5.2f}:1  {'PASS' if x['pass_aa'] else 'FAIL'}  {x['label']}")
