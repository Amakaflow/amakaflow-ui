# YouTube Transcript Ingestion (Current Flow)

The `/ingest/youtube` endpoint now accepts a pre-generated transcript instead of pulling data directly from YouTube. This keeps the workflow simple while YouTube’s streaming restrictions (PO tokens, SABR formats, n-sig challenges) are in flux.

## Quick Start

Set your youtube-transcript.io token once per session:

```bash
export YT_TRANSCRIPT_API_TOKEN="your-api-token"
```

Then call the endpoint with only the video URL:

```bash
curl -X POST "http://localhost:8001/ingest/youtube" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=VIDEO_ID"
  }'
```

The service will fetch the transcript automatically using [youtube-transcript.io](https://www.youtube-transcript.io/api), convert it to your canonical JSON, and return structured exercises. No manual transcript is needed.
