FROM python:3.11-slim

WORKDIR /app

# Ensure Python can import from src/
ENV PYTHONPATH=/app/src:${PYTHONPATH}

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8003

# Run the application
CMD ["uvicorn", "calendar_api.main:app", "--host", "0.0.0.0", "--port", "8003", "--reload"]
