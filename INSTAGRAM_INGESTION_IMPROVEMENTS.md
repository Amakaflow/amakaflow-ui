# Instagram Ingestion Improvements

This document describes the improvements made to the Instagram workout ingestion system to address common failure modes and improve reliability.

## Overview

The Instagram ingestion endpoint (`/ingest/instagram_test`) has been enhanced to better handle:
- **Low-quality image extraction** from Instagram posts
- **Private or expired posts** requiring authentication
- **Short-lived CDN URLs** that expire quickly
- **Vision model integration** for superior text extraction accuracy

## Common Failure Modes Addressed

### 1. Using Page URL Instead of Image URL ✅

**Problem:** Instagram provides page URLs (`https://www.instagram.com/p/abc123/`) but we need direct image URLs for processing.

**Solution:**
- Multiple extraction methods implemented:
  - **Open Graph meta tags** (`<meta property="og:image">`)
  - **JSON-LD structured data** (`<script type="application/ld+json">`)
  - **window._sharedData** (Instagram's embedded data)
  - **__additionalDataLoaded** (newer Instagram format)
  - **CDN URL patterns** (fallback for direct image URLs)
- Prioritizes `display_resources` from `window._sharedData` which are typically higher quality
- URL cleaning to remove size parameters and get original resolution

**Location:** `app/services/instagram_service.py` - `download_post_images_no_login()`

### 2. Private or Friends-Only Posts ✅

**Problem:** Private posts require authentication and can't be accessed via web scraping.

**Solution:**
- Detects private posts by checking for login prompts in HTML
- Provides clear error messages suggesting username/password authentication
- Falls back to login-based method (`instagrapi` or `Instaloader`) when credentials provided
- Web scraping method used by default (no login required)

**Location:** `app/services/instagram_service.py` - private post detection

### 3. Short-Lived or Blocked URLs ✅

**Problem:** Instagram CDN URLs expire quickly or may be blocked by geo-restrictions.

**Solution:**
- **Retry logic** with multiple URL variants:
  - Original URL
  - URL with size parameters removed
  - Base URL without query parameters
- **Proper headers** including Referer for Instagram CDN
- **Graceful degradation** - continues with remaining images if some fail
- **Size validation** - ensures downloaded files are valid (>1KB)
- **Clear error messages** suggesting manual upload as fallback

**Location:** `app/services/instagram_service.py` - download retry logic

### 4. Wrong Model or Payload Format ✅

**Problem:** Using non-vision models or incorrect payload format causes API errors.

**Solution:**
- Proper vision model selection (`gpt-4o-mini`, `gpt-4o`, `claude-3-5-sonnet`)
- Correct payload format with base64 image encoding
- API key validation and fallback to environment variables
- Post-processing to ensure valid workout structure (e.g., setting default `type` for exercises)

**Location:** `app/services/vision_service.py`, `app/api/routes.py`

## Key Improvements

### Image URL Extraction (`instagram_service.py`)

**Multiple Extraction Methods:**
```python
# Method 1: Open Graph meta tags (higher quality)
og_image_pattern = r'<meta\s+property="og:image"\s+content="([^"]+)"'

# Method 2: JSON-LD structured data
json_ld_pattern = r'<script type="application/ld\+json">(.*?)</script>'

# Method 3: window._sharedData (Instagram's embedded data)
shared_data_pattern = r'window\._sharedData\s*=\s*({.*?});'

# Method 4: __additionalDataLoaded (newer format)
additional_data_pattern = r'__additionalDataLoaded\([^,]+,\s*({.*?})\);'

# Method 5: CDN URL patterns (fallback)
instagram_cdn_pattern = r'(https?://[^"]*instagram\.com[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)'
```

**URL Cleaning for Higher Resolution:**
- Removes size parameters (`s640x640`, `s1080x1080`)
- Removes query parameters that limit image size
- Tries multiple URL variants during download

### Download Retry Logic

```python
# Retry with multiple URL variants
for attempt in range(max_retries):
    try:
        # Try cleaned URL first (higher resolution)
        img_response = requests.get(cleaned_url, headers=headers, ...)
        
        # Handle 403/404 - might be expired
        if img_response.status_code == 403:
            # Try original URL on retry
            continue
        elif img_response.status_code == 404:
            # URL expired, skip this image
            break
            
        # Validate file size
        if os.path.getsize(filepath) > 1024:
            image_paths.append(filepath)
            break
    except requests.RequestException:
        # Retry with next variant
        continue
```

### Enhanced Vision Model Prompts

**Previous (Too Strict):**
```
CRITICAL: Extract workout information ONLY from what you can ACTUALLY SEE.
Do NOT make up or guess exercises that are not visible.
```

**Improved (Better Balance):**
```
Extract ALL workout information you can see in these Instagram workout images.
If text is partially visible or unclear, include it with your best interpretation.
Look for workout structure patterns (rounds, sets, circuits, etc.).
If images are low quality, extract what you can see and note any uncertainty.
```

**Result:** Better extraction of stylized text, abbreviations, and partially visible content.

### Error Handling

**Private Post Detection:**
```python
private_indicators = [
    'Log In' in html[:1000],
    'Sign Up' in html[:1000],
    'This page isn\'t available' in html,
    'Sorry, this page' in html,
]

if any(private_indicators):
    raise InstagramServiceError(
        "Instagram post appears to be private or requires login. "
        "Please provide username and password to access this post."
    )
```

**Helpful Error Messages:**
- Suggests providing username/password for private posts
- Recommends manual screenshot upload as fallback
- Includes diagnostic information for debugging

## Testing

### Test Script

A comprehensive test script is available: `test_instagram_ingestion.py`

**Requirements:**
```bash
pip install requests
```

**Usage:**
```bash
# Test with OCR (default)
python test_instagram_ingestion.py https://www.instagram.com/p/DRHiuniDM1K/

# Test with Vision model
python test_instagram_ingestion.py https://www.instagram.com/p/DRHiuniDM1K/ --vision

# Test multiple URLs with both methods
python test_instagram_ingestion.py \
    https://www.instagram.com/p/DRHiuniDM1K/ \
    https://www.instagram.com/p/DOyajJ9AukY/ \
    --vision --ocr

# Save results to JSON
python test_instagram_ingestion.py \
    https://www.instagram.com/p/DRHiuniDM1K/ \
    --vision \
    --output results.json

# From Docker container (requests already installed)
docker compose exec workout-ingestor-api python test_instagram_ingestion.py \
    https://www.instagram.com/p/DRHiuniDM1K/ \
    --vision
```

### Manual Testing

**cURL Example:**
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

**Expected Response:**
```json
{
  "title": "Workout Title",
  "blocks": [
    {
      "label": "Block 1",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": 10,
          "type": "strength"
        }
      ]
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

## Performance Metrics

### Before Improvements
- ❌ Failed to extract images from most Instagram posts
- ❌ Low-quality images (640x640 or smaller)
- ❌ Vision model returned 0 exercises
- ❌ No error handling for private/expired posts

### After Improvements
- ✅ Successfully extracts images from public Instagram posts
- ✅ Higher quality images (removed size parameters)
- ✅ Vision model extracts exercises correctly (e.g., 3 blocks, 5 exercises)
- ✅ Clear error messages for private/expired posts
- ✅ Retry logic handles transient failures

## Architecture

### Request Flow

```
1. User provides Instagram URL
   ↓
2. Extract image URLs from Instagram page HTML
   ↓
3. Clean URLs to get higher resolution versions
   ↓
4. Download images with retry logic
   ↓
5. Process images with OCR or Vision model
   ↓
6. Structure workout data
   ↓
7. Return JSON response
```

### Fallback Strategy

```
Primary: Vision Model (OpenAI GPT-4o-mini)
  ↓ (if fails)
Secondary: OCR (Tesseract/EasyOCR)
  ↓ (if fails)
Error: Suggest manual screenshot upload
```

## Configuration

### Environment Variables

```bash
# OpenAI API key for vision model
OPENAI_API_KEY=sk-proj-...

# Instagram credentials (optional, for private posts)
INSTAGRAM_USERNAME=...
INSTAGRAM_PASSWORD=...
```

### API Parameters

**Required:**
- `url`: Instagram post URL

**Optional:**
- `use_vision`: Use vision model instead of OCR (default: `false`)
- `vision_provider`: `"openai"` or `"anthropic"` (default: `"openai"`)
- `vision_model`: Model name (default: `"gpt-4o-mini"`)
- `openai_api_key`: API key (optional, uses env var if not provided)
- `username`: Instagram username (optional, for private posts)
- `password`: Instagram password (optional, for private posts)

## Troubleshooting

### Issue: "Could not extract image URLs"

**Possible Causes:**
- Post is private (requires login)
- Instagram page structure changed
- Network/connection issues

**Solutions:**
1. Provide username/password for private posts
2. Try manual screenshot upload
3. Check if post is publicly accessible in browser
4. Review logs for diagnostic information

### Issue: "Failed to download images"

**Possible Causes:**
- URLs expired (Instagram CDN URLs are short-lived)
- Geo-restrictions
- Rate limiting

**Solutions:**
1. Retry the request (retry logic is automatic)
2. Try providing username/password
3. Use manual screenshot upload
4. Check network connectivity

### Issue: "Vision model returns 0 exercises"

**Possible Causes:**
- Images are too low quality
- No workout text visible in images
- Vision model prompt too strict

**Solutions:**
1. Try OCR method instead (`use_vision: false`)
2. Check if images contain visible workout text
3. Review vision model logs for details

## Future Improvements

- [ ] Instagram oEmbed API integration for more reliable image extraction
- [ ] Support for Instagram Reels (video posts)
- [ ] Batch processing for multiple Instagram posts
- [ ] Caching of extracted image URLs to reduce API calls
- [ ] Image quality scoring to select best images for processing
- [ ] Support for Instagram Stories (24-hour posts)

## References

- [Instagram Graph API Documentation](https://developers.facebook.com/docs/instagram-api/)
- [OpenAI Vision API Documentation](https://platform.openai.com/docs/guides/vision)
- [Anthropic Claude Vision Documentation](https://docs.anthropic.com/claude/docs/vision)

