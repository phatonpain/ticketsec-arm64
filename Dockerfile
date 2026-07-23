# syntax=docker/dockerfile:1
# TicketSec Arm64 — all-in-one image: Vite build + FastAPI/ONNX Runtime.
# Multi-arch: works on amd64 and arm64 (ONNX Runtime ships both wheels),
# so the same Dockerfile builds natively on Graviton.
#
#   docker build -t ticketsec .
#   docker run --rm -p 8000:8000 ticketsec
#   open http://localhost:8000   (UI + API on the same port)

# ---- Stage 1: frontend build ------------------------------------------------
FROM node:22-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
# The build imports committed model artifacts (metrics traceability, G7).
COPY index.html vite.config.ts ./
COPY tsconfig*.json tailwind.config.js postcss.config.js ./
COPY src ./src
COPY public ./public
COPY model ./model
RUN npm run build

# ---- Stage 2: runtime --------------------------------------------------------
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /srv
COPY app/requirements.txt ./app/requirements.txt
RUN pip install --no-cache-dir -r app/requirements.txt
COPY app ./app
# Only the committed artifacts the server/UI need — no training pipeline.
COPY model/artifact.onnx model/artifact_meta.json model/categories.py \
     model/__init__.py ./model/
COPY model/test_set.jsonl ./model/
COPY --from=frontend /build/dist ./dist
EXPOSE 8000
# /predict is rate-limited in-app; no auth by design (hackathon demo).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
