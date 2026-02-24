# YouTube Ingestion Failure Investigation (AMA-242)

This document tracks YouTube video links that fail to process through the AmakaFlow ingestor.

## Failing URLs

| Date Reported | URL | Video ID | Status | Failure Reason |
|--------------|-----|----------|--------|----------------|
| 2026-01-04 | https://www.youtube.com/watch?v=95hX_OMuIpg | 95hX_OMuIpg | Investigating | TBD |
| 2026-01-07 | https://www.youtube.com/watch?v=r78WzW27-UI | r78WzW27-UI | Investigating | TBD |

## How to Add New Failing URLs

When a new YouTube URL fails to ingest:

1. Add the URL to the table above with current date
2. Test manually using the YouTube ingest endpoint
3. Check the video for:
   - Age restriction
   - Private/unlisted status
   - Region locks
   - Availability of captions/subtitles
   - Video type (Shorts, live stream, regular)
4. Check logs for specific error messages
5. Update the failure reason in the table

## Potential Failure Causes

Based on the YouTube ingest implementation, potential failure causes include:

1. **No Transcript Available** (HTTP 404)
   - Video has captions disabled
   - Auto-generated captions not available
   - Video is too short (<30 seconds)
   - Video is a live stream

2. **Age-Restricted Content** (HTTP 403)
   - Video requires age verification
   - Cannot be accessed via transcript API

3. **Region-Locked Content** (HTTP 403)
   - Video not available in certain countries
   - Content blocked by YouTube

4. **Private/Unlisted Videos** (HTTP 403)
   - Video is set to private
   - Video is unlisted but not shareable

5. **API Rate Limiting** (HTTP 429)
   - Too many requests to transcript API
   - YouTube API limits exceeded

6. **LLM Parsing Failures**
   - Transcript extracted but parsing fails
   - Video is not a workout video
   - Transcript quality too low

## Investigation Process

### Step 1: Manual Test
```bash
curl -X POST "http://localhost:8001/ingest/youtube" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

### Step 2: Check Video Metadata
- Visit the video page directly
- Check if age-restricted
- Check if private/unlisted
- Check if region-blocked
- Check if captions are available

### Step 3: Check Transcript API
```bash
# Test with youtube-transcript.io API directly
curl -X POST "https://www.youtube-transcript.io/api/transcripts" \
  -H "Authorization: Basic $YT_TRANSCRIPT_API_TOKEN" \
  -d '{"ids": ["VIDEO_ID"]}'
```

### Step 4: Review Error Logs
Check the ingestor logs for:
- Specific HTTP status codes
- Error messages from transcript API
- LLM parsing errors

## Resolution Options

1. **For age-restricted videos**: Cannot be processed (YouTube API limitation)
2. **For private videos**: Request owner to make public or provide transcript
3. **For region-locked**: May work with VPN/proxy (not recommended)
4. **For no captions**: Request video owner to enable captions
5. **For live streams**: Wait for VOD availability
6. **For API issues**: Implement retry with exponential backoff

## Related Files

- `src/workout_ingestor_api/api/youtube_ingest.py` - Main YouTube ingestion logic
- `src/workout_ingestor_api/services/youtube_cache_service.py` - Caching service
