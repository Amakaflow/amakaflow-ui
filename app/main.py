"""Main FastAPI application."""
from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(title="Workout Ingestor API")
app.include_router(router)

