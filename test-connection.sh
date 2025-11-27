#!/bin/bash
# Test script to verify database connection after setting password

echo "Testing calendar-api database connection..."
echo ""

cd "$(dirname "$0")"
source venv/bin/activate 2>/dev/null || echo "⚠️  venv not activated"

python3 << 'PYTHON'
import os
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_db_password = os.getenv("SUPABASE_DB_PASSWORD")
database_url = os.getenv("DATABASE_URL")

if not database_url and supabase_url and supabase_db_password:
    # Construct connection string
    project_ref = supabase_url.replace("https://", "").replace(".supabase.co", "")
    database_url = f"postgresql://postgres:{supabase_db_password}@db.{project_ref}.supabase.co:5432/postgres"

if not database_url:
    print("❌ DATABASE_URL or SUPABASE_DB_PASSWORD not set")
    print("   Please set SUPABASE_DB_PASSWORD in calendar-api/.env")
    exit(1)

print(f"✓ Database URL configured")
print(f"  Host: db.{supabase_url.replace('https://', '').replace('.supabase.co', '')}.supabase.co")
print("")

# Test connection
try:
    import psycopg
    print("Testing connection...")
    conn = psycopg.connect(database_url)
    with conn.cursor() as cur:
        cur.execute("SELECT 1")
        result = cur.fetchone()
    conn.close()
    print("✅ Database connection successful!")
    print("   calendar-api is ready to use")
except Exception as e:
    print(f"❌ Database connection failed: {e}")
    print("   Please check your SUPABASE_DB_PASSWORD in calendar-api/.env")
    exit(1)
PYTHON
