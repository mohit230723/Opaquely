# Concrete ML needs Linux (x86_64). One image runs the trainer, the FHE server and the seller helper.
# Python 3.11: onnxoptimizer (a Concrete ML dependency) ships prebuilt wheels for it, not for 3.12.
# The build tools are a fallback in case pip still has to compile a dependency from source.
FROM python:3.11-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential cmake \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# CPU-only PyTorch first (Concrete ML pins torch 2.3.1): skips about 2.5 GB of unused NVIDIA CUDA libraries.
RUN pip install --no-cache-dir torch==2.3.1 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py .
ENV ML_ARTIFACTS=/artifacts
