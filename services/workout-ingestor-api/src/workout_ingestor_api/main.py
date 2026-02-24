"""Main FastAPI application."""
import os
import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from workout_ingestor_api.api.routes import router
from workout_ingestor_api.api.bulk_import_routes import router as bulk_import_router
from workout_ingestor_api.api.parse_routes import router as parse_router

# Initialize Sentry for error tracking (AMA-225)
sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=os.getenv("ENVIRONMENT", "development"),
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        enable_tracing=True,
    )

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
app.include_router(parse_router)

