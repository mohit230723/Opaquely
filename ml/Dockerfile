# Concrete ML needs Linux (x86_64). One image runs the trainer, the FHE server and the seller helper.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py .
ENV ML_ARTIFACTS=/artifacts
