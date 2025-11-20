FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for tesseract-ocr and Node.js
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
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

# Expose port 8004
EXPOSE 8004

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004", "--reload"]
