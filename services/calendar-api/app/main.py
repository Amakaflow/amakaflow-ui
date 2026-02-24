"""
FastAPI application for Calendar API.
"""
import os
import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes.calendar import router as calendar_router
from .routes.smart_planner import router as smart_planner_router
from .routes.programs import router as programs_router
from .routes.training_programs import router as training_programs_router

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

app = FastAPI(
    title="AmakaFlow Calendar API",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://ui:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Smart planner FIRST (so /calendar/rules doesn't get caught by /calendar/{event_id})
app.include_router(smart_planner_router, prefix="/planner", tags=["smart-planner"])
app.include_router(calendar_router, prefix="/calendar", tags=["calendar"])
app.include_router(programs_router, prefix="/program-events", tags=["program-events"])
# Training programs CRUD endpoints (AMA-528)
app.include_router(training_programs_router, prefix="/training-programs", tags=["training-programs"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.1.0"}
