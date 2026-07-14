# TicketSec Arm64 — Docker image for Arm64 inference
# Build: docker buildx build --platform linux/arm64 -t ticketsec-arm64 .
# Run:   docker run -p 8000:8000 ticketsec-arm64

FROM python:3.11-slim

WORKDIR /app

# Install system deps (lightweight for Arm64)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY train.py convert_onnx.py quantize.py benchmark.py api.py ./
COPY models/ ./models/
COPY data/ ./data/
COPY results/ ./results/

# Default: run the API
ENV MODEL_PATH=models/quantized_model.onnx
EXPOSE 8000

CMD ["python", "api.py"]
