# TikTok Video Ingestion

This document describes how to ingest workouts from TikTok videos.

## Endpoint

```
POST /ingest/tiktok
```

### Request Body

```json
{
  "url": "https://www.tiktok.com/@jeffnippardfitness/video/7575571317500546322"
}
```

### Supported URL Formats

- Standard: `https://www.tiktok.com/@username/video/1234567890`
- Short URLs: `https://vm.tiktok.com/XXXXXX/`
- Short URLs (alt): `https://www.tiktok.com/t/XXXXXX/`

## How It Works

1. **Metadata Extraction**: Uses TikTok's official oEmbed API to extract:
   - Video title (often contains workout description)
   - Author name and URL
   - Thumbnail
   - Hashtags (extracted from title)

2. **Video Download**: Downloads the video using `yt-dlp`

3. **Frame Extraction**: Samples frames from the video at 0.5 fps

4. **OCR Processing**: Extracts text from frames using OCR

5. **Workout Parsing**: Combines description + OCR text and parses into workout format

## Response

Standard workout response with additional TikTok metadata in `_provenance`:

```json
{
  "title": "Full Body Workout",
  "blocks": [...],
  "_provenance": {
    "mode": "tiktok_video",
    "source_url": "https://www.tiktok.com/@user/video/123",
    "video_id": "7575571317500546322",
    "author": "jeffnippardfitness",
    "hashtags": ["workout", "fitness", "gym"],
    "extraction_method": "ocr"
  }
}
```

## Metadata Preview

To preview video metadata without full ingestion:

```
GET /tiktok/metadata?url=https://www.tiktok.com/@user/video/123
```

Returns:
```json
{
  "video_id": "7575571317500546322",
  "url": "https://www.tiktok.com/@user/video/123",
  "title": "Workout title #fitness",
  "author_name": "username",
  "author_url": "https://www.tiktok.com/@username",
  "thumbnail_url": "https://...",
  "hashtags": ["fitness"]
}
```

## Dependencies

- `yt-dlp` - For video download
- `requests` - For oEmbed API calls
- OCR service (already in project)
- Video service (already in project)

## Example Usage

### Python
```python
import requests

response = requests.post(
    "http://localhost:8000/ingest/tiktok",
    json={"url": "https://www.tiktok.com/@jeffnippardfitness/video/7575571317500546322"}
)
workout = response.json()
print(workout["title"])
```

### cURL
```bash
curl -X POST http://localhost:8000/ingest/tiktok \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.tiktok.com/@jeffnippardfitness/video/7575571317500546322"}'
```

## Limitations

- **Private Videos**: Cannot access private or friends-only videos
- **Rate Limiting**: TikTok may rate limit frequent requests
- **Video Length**: Very long videos may timeout during download
- **Text Quality**: OCR quality depends on video resolution and text visibility

## Troubleshooting

### "Could not download TikTok video"
- Video may be private or deleted
- TikTok may be rate limiting
- Try updating yt-dlp: `pip install -U yt-dlp`

### "No workout text found"
- Video may not contain visible text/instructions
- Try the `/ingest/image` endpoint with screenshots instead

### "Invalid TikTok URL"
- Ensure URL is a video URL (contains `/video/` or is a valid short URL)
- Profile URLs and sound URLs are not supported