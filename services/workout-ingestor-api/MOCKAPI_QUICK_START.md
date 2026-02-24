# Quick Start: Create All MockAPI.io Resources

## Step 1: Create Resources in MockAPI.io Dashboard

You need to manually create the resources first. Click "New resource" for each one:

1. **health** - Name: `health`
2. **ingest_text** - Name: `ingest_text`
3. **ingest_ai_workout** - Name: `ingest_ai_workout`
4. **ingest_image** - Name: `ingest_image`
5. **ingest_url** - Name: `ingest_url`
6. **ingest_instagram_test** - Name: `ingest_instagram_test`
7. **ingest_youtube** - Name: `ingest_youtube`
8. **export_tp_text** - Name: `export_tp_text`
9. **export_tcx** - Name: `export_tcx`

### Quick Steps:
1. Click **"New resource"** button
2. Enter the resource name (e.g., `health`)
3. Click Create/Save
4. Repeat for all 9 resources above

## Step 2: Populate Resources with Data

After creating all resources, run this command to populate them with example data:

```bash
bash scripts/create_mockapi_resources.sh
```

Or if you have Python with requests installed:

```bash
python scripts/create_mockapi_resources.py
```

## Step 3: Verify

After running the script, refresh your MockAPI.io dashboard. You should see:
- All 9 resources listed
- Each resource containing at least 1 item with example data

## Testing Your Resources

Once created and populated, test them:

```bash
# Test health endpoint
curl https://6917363aa7a34288a27ff1d6.mockapi.io/api/v1/health

# Test ingest_text endpoint
curl https://6917363aa7a34288a27ff1d6.mockapi.io/api/v1/ingest_text
```

