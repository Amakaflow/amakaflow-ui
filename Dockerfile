FROM python:3.11-slim

WORKDIR /app

# Copy requirements if it exists, otherwise we'll install common dependencies
COPY requirements.txt* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; else pip install --no-cache-dir fastapi uvicorn pydantic pyyaml rapidfuzz; fi

# Copy application code
COPY . .

# Expose port 8001
EXPOSE 8001

# Run the FastAPI application
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
