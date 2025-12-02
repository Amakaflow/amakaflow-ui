FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for tesseract-ocr, Node.js, and ffmpeg
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    ffmpeg \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Add src to Python path so workout_ingestor_api can be imported
ENV PYTHONPATH=/app/src:${PYTHONPATH}

# Expose port 8004
EXPOSE 8004

# Run the application
CMD ["uvicorn", "workout_ingestor_api.main:app", "--host", "0.0.0.0", "--port", "8004", "--reload"]