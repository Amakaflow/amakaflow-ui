FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Add src to Python path so garmin_sync_api can be imported
ENV PYTHONPATH=/app/src:${PYTHONPATH}

# Expose port
EXPOSE 8002

# Run the FastAPI application
CMD ["uvicorn", "garmin_sync_api.app:app", "--host", "0.0.0.0", "--port", "8002", "--reload"]
