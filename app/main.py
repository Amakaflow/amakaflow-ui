"""
FastAPI application for Calendar API.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes.calendar import router as calendar_router
from .routes.smart_planner import router as smart_planner_router

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


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.1.0"}
