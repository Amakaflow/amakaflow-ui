#!/bin/bash
# Run script for Strava Connections Service

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

# Run the service
uvicorn main:app --reload --host 0.0.0.0 --port 8000

