"""
FastAPI application for Calendar API.

Provides CRUD operations for workout events stored in PostgreSQL.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.calendar import router as calendar_router

app = FastAPI(
    title="AmakaFlow Calendar API",
    description="API for managing workout calendar events",
    version="1.0.0",
)

# Configure CORS to allow requests from the UI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],  # Allow all for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include calendar routes
app.include_router(calendar_router, prefix="/calendar", tags=["calendar"])


@app.get("/healthz")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}

