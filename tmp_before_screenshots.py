from playwright.sync_api import sync_playwright
import os

out = r'D:\ComfyUI\ticketsec-arm64-dashboard\screenshots\m8\before'
os.makedirs(out, exist_ok=True)

views = [
    ('dashboard', '#/dashboard'),
    ('detections', '#/detections'),
    ('threat-analytics', '#/threat-analytics'),
    ('system-health', '#/system-health'),
]

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, hash_path in views:
        page = browser.new_page(viewport={'width': 1366, 'height': 900})
        page.goto(f'http://localhost:4173/{hash_path}')
        page.wait_for_timeout(4000)
        # Expand viewport to fit content
        needed = page.evaluate('() => { const main = document.querySelector("main"); return main ? main.scrollHeight + 120 : 2000; }')
        page.set_viewport_size({'width': 1366, 'height': max(needed, 900)})
        page.wait_for_timeout(500)
        page.evaluate('() => { window.scrollTo(0,0); const main = document.querySelector("main"); if (main) main.scrollTop = 0; }')
        try:
            page.wait_for_function(
                """() => {
                    const pill = document.querySelector('div[role="button"]');
                    return pill && !pill.textContent.includes('Connecting');
                }""",
                timeout=10000
            )
        except Exception:
            pass
        page.wait_for_timeout(300)
        path = os.path.join(out, f'{name}-1366.png')
        page.screenshot(path=path)
        print('saved', path, 'height', max(needed, 900))
        page.close()
    browser.close()
