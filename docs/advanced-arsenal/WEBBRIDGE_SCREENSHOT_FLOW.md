# WebBridge Screenshot Flow for UI Verification

> **One-shot, repeatable flow for capturing honest dashboard screenshots at
> 1366 px per route.** Use this whenever a UI phase needs visual evidence.

## Prerequisites

1. WebBridge daemon is running and extension connected:
   ```bash
   ~/.kimi-webbridge/bin/kimi-webbridge status
   # Expected: running: true, extension_connected: true
   ```
2. Frontend dev server is running:
   ```bash
   cd ticketsec-arm64-dashboard
   npm run dev -- --port 5173
   ```
3. Output directory exists:
   ```bash
   mkdir -p screenshots/<phase>
   ```

## Capture a route

```bash
ROUTE=dashboard
PHASE=p8
OUTDIR="screenshots/${PHASE}"
mkdir -p "$OUTDIR"

# 1. Navigate in a new tab
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d "{\"action\":\"navigate\",\"args\":{\"url\":\"http://localhost:5173/#/${ROUTE}\",\"newTab\":true},\"session\":\"ticketsec-screenshots\"}"

# 2. Resize the viewport to 1366 px width (height is flexible)
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d "{\"action\":\"evaluate\",\"args\":{\"code\":\"window.resizeTo(1366, 768); return {w: window.innerWidth, h: window.innerHeight};\"},\"session\":\"ticketsec-screenshots\"}"

# 3. Snapshot the accessibility tree (optional sanity check)
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d "{\"action\":\"snapshot\",\"args\":{},\"session\":\"ticketsec-screenshots\"}"

# 4. Screenshot to the phase directory
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d "{\"action\":\"screenshot\",\"args\":{\"path\":\"${PWD}/${OUTDIR}/${ROUTE}-1366.png\"},\"session\":\"ticketsec-screenshots\"}"
```

## Route list

Capture all five hash routes:

```bash
for R in dashboard detections analytics registry health; do
  echo "Capturing $R"
  # navigate, resize, screenshot as above
  sleep 1
done
```

## Honesty check before saving

Inspect the screenshot or snapshot for:

- Header badge matches the intended state (`LIVE`, `CACHED`, or `API OFFLINE`).
- No metric is shown without provenance (`from eval_results.json`,
  `Offline benchmark`, etc.).
- Event Log contains only real entries.

If the badge is wrong for the intended evidence, fix the store/seed state first;
do not photoshop or crop to hide it.

## Cleanup

```bash
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"close_session","args":{},"session":"ticketsec-screenshots"}'
```

## Evidence naming convention

```text
screenshots/<phase>/<route>-1366.png
screenshots/<phase>/<route>-1366-annotated.png   # if arrows/captions added
```

## Acceptance criteria

- [ ] Daemon status shows `running: true` and `extension_connected: true`.
- [ ] Viewport width is 1366 px.
- [ ] All five routes captured.
- [ ] Badge state in screenshot matches the intended evidence narrative.
- [ ] Files are committed, not left as untracked scratch files.
