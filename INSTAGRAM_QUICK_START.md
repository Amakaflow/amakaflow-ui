# Instagram Ingestion Quick Start Guide

## Overview

The Instagram ingestion endpoint allows you to extract workout data from Instagram posts by:
1. Downloading images from the Instagram post
2. Extracting text using OCR or Vision models
3. Structuring the workout data into JSON format

## Quick Examples

### Using cURL

**Test with OCR (Free):**
```bash
curl -X POST http://localhost:8004/ingest/instagram_test \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.instagram.com/p/DRHiuniDM1K/"
  }'
```

**Test with Vision Model (Better Accuracy, Low Cost):**
```bash
curl -X POST http://localhost:8004/ingest/instagram_test \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.instagram.com/p/DRHiuniDM1K/",
    "use_vision": true,
    "vision_provider": "openai",
    "vision_model": "gpt-4o-mini"
  }'
```

**With OpenAI API Key:**
```bash
curl -X POST http://localhost:8004/ingest/instagram_test \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.instagram.com/p/DRHiuniDM1K/",
    "use_vision": true,
    "vision_provider": "openai",
    "vision_model": "gpt-4o-mini",
    "openai_api_key": "sk-proj-..."
  }'
```

### Using Test Script

**Install Requirements:**
```bash
pip install requests
```

**Run Test:**
```bash
# Test with OCR
python test_instagram_ingestion.py https://www.instagram.com/p/DRHiuniDM1K/

# Test with Vision
python test_instagram_ingestion.py https://www.instagram.com/p/DRHiuniDM1K/ --vision

# Test both methods
python test_instagram_ingestion.py https://www.instagram.com/p/DRHiuniDM1K/ --vision --ocr
```

**From Docker Container:**
```bash
docker compose exec workout-ingestor-api python test_instagram_ingestion.py \
  https://www.instagram.com/p/DRHiuniDM1K/ \
  --vision
```

## Response Format

```json
{
  "title": "Workout Title",
  "source": "https://www.instagram.com/p/DRHiuniDM1K/",
  "blocks": [
    {
      "label": "Block 1",
      "structure": "3 rounds",
      "exercises": [
        {
          "name": "Jumping Jacks",
          "sets": 3,
          "reps": 10,
          "type": "strength",
          "notes": null
        },
        {
          "name": "Back Squat",
          "sets": 3,
          "reps": 8,
          "type": "strength",
          "notes": null
        }
      ],
      "supersets": []
    }
  ],
  "_provenance": {
    "mode": "instagram_image_test",
    "source_url": "https://www.instagram.com/p/DRHiuniDM1K/",
    "image_count": 6,
    "extraction_method": "vision",
    "vision_provider": "openai",
    "vision_model": "gpt-4o-mini"
  }
}
```

## Common Use Cases

### 1. Public Instagram Post (No Login Required)

```bash
curl -X POST http://localhost:8004/ingest/instagram_test \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.instagram.com/p/POST_ID/"}'
```

### 2. Private Instagram Post (Login Required)

```bash
curl -X POST http://localhost:8004/ingest/instagram_test \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.instagram.com/p/POST_ID/",
    "username": "your_username",
    "password": "your_password"
  }'
```

### 3. High Accuracy with Vision Model

```bash
# Set OPENAI_API_KEY environment variable first
export OPENAI_API_KEY=sk-proj-...

curl -X POST http://localhost:8004/ingest/instagram_test \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.instagram.com/p/POST_ID/",
    "use_vision": true
  }'
```

## Troubleshooting

### Error: "Could not extract image URLs"

**Cause:** Post might be private, deleted, or Instagram's structure changed.

**Solution:**
- Provide username/password if post is private
- Try manual screenshot upload instead
- Check if post is publicly accessible in browser

### Error: "Failed to download images"

**Cause:** URLs expired or blocked by Instagram CDN.

**Solution:**
- Retry the request (retry logic is automatic)
- Try providing username/password
- Use manual screenshot upload

### Error: "Vision model returns 0 exercises"

**Cause:** Images too low quality or no visible workout text.

**Solution:**
- Try OCR method instead (`use_vision: false`)
- Check if images contain visible workout text
- Review logs for details

### Error: "Connection error: Could not connect to http://localhost:8004"

**Cause:** API not running.

**Solution:**
```bash
# Start Docker services
docker compose up -d

# Check API health
curl http://localhost:8004/health
```

## Cost Comparison

### OCR (Free)
- **Cost:** $0
- **Accuracy:** Good for clear, typed text
- **Speed:** Fast (~5-10 seconds)
- **Best For:** Clear screenshots with typed text

### Vision Model (Low Cost)
- **Cost:** ~$0.0001-0.0002 per image
- **Accuracy:** Excellent for handwritten/stylized text
- **Speed:** Moderate (~15-30 seconds)
- **Best For:** Instagram posts, handwritten notes, stylized fonts

**Example:** 1,000 workouts (6 images each) = ~$0.60-1.20

## API Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | ✅ Yes | - | Instagram post URL |
| `use_vision` | boolean | ❌ No | `false` | Use vision model instead of OCR |
| `vision_provider` | string | ❌ No | `"openai"` | `"openai"` or `"anthropic"` |
| `vision_model` | string | ❌ No | `"gpt-4o-mini"` | Model name |
| `openai_api_key` | string | ❌ No | Env var | OpenAI API key |
| `username` | string | ❌ No | - | Instagram username (for private posts) |
| `password` | string | ❌ No | - | Instagram password (for private posts) |

## Next Steps

1. **Test with a real Instagram post:** Use the examples above
2. **Compare OCR vs Vision:** Test both methods on the same post
3. **Review full documentation:** See `INSTAGRAM_INGESTION_IMPROVEMENTS.md` for details
4. **Integrate into your app:** Use the API endpoint in your frontend

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs: `docker compose logs workout-ingestor-api`
3. See full documentation: `INSTAGRAM_INGESTION_IMPROVEMENTS.md`

