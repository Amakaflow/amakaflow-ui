"""
Database connection helper for calendar-api.

Uses the same environment variable pattern as mapper-api:
- SUPABASE_URL and SUPABASE_DB_PASSWORD (constructs connection string)
- Or DATABASE_URL (direct PostgreSQL connection string)
"""
import os
import psycopg
from contextlib import contextmanager
from typing import Generator

# Load from .env file if present
from dotenv import load_dotenv
load_dotenv()

# Try to get DATABASE_URL directly first
DATABASE_URL = os.getenv("DATABASE_URL")

# If not set, try to construct from Supabase env vars (same pattern as mapper-api)
if not DATABASE_URL:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_db_password = os.getenv("SUPABASE_DB_PASSWORD")
    
    if supabase_url and supabase_db_password:
        # Extract project ref from SUPABASE_URL (e.g., https://wdeqaibnwjekcyfpuple.supabase.co)
        # Convert to: postgresql://postgres:[PASSWORD]@db.wdeqaibnwjekcyfpuple.supabase.co:5432/postgres
        if ".supabase.co" in supabase_url:
            project_ref = supabase_url.replace("https://", "").replace(".supabase.co", "")
            DATABASE_URL = f"postgresql://postgres:{supabase_db_password}@db.{project_ref}.supabase.co:5432/postgres"
        else:
            # Fallback: assume it's already a database URL format
            DATABASE_URL = supabase_url

if not DATABASE_URL:
    import warnings
    warnings.warn(
        "DATABASE_URL or (SUPABASE_URL + SUPABASE_DB_PASSWORD) environment variables not set. "
        "Set DATABASE_URL directly or SUPABASE_URL + SUPABASE_DB_PASSWORD in .env file."
    )


@contextmanager
def get_db_connection() -> Generator[psycopg.Connection, None, None]:
    """
    Context manager for database connections.
    
    Usage:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT ...")
                result = cur.fetchall()
    """
    conn = psycopg.connect(DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

