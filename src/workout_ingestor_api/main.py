"""Main FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from workout_ingestor_api.api.routes import router
from workout_ingestor_api.api.bulk_import_routes import router as bulk_import_router

app = FastAPI(title="Workout Ingestor API")

# Configure CORS to allow requests from the UI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(bulk_import_router)

