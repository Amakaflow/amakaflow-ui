# MockAPI.io Setup Guide

This guide explains how to set up mock endpoints on mockapi.io for the Workout Ingestor API.

## Quick Start

1. **Create a MockAPI.io project**
   - Go to https://mockapi.io
   - Sign up / Log in
   - Create a new project
   - Note your project URL (e.g., `https://<project_id>.mockapi.io/api/v1`)

2. **Generate endpoint documentation**
   ```bash
   python scripts/setup_mockapi.py
   ```
   This will create:
   - `mockapi_endpoints.json` - Complete endpoint definitions
   - `mockapi_examples.json` - Example responses for each endpoint

3. **Set up endpoints in MockAPI.io dashboard**
   - Use the generated JSON files as reference
   - Configure custom routes in MockAPI.io (since it's resource-based, you may need custom route mapping)

## All API Endpoints

### 1. GET /health
**Description:** Health check endpoint

**Request:**
```http
GET /health
```

**Response:**
```json
{
  "ok": true
}
```

---

### 2. POST /ingest/text
**Description:** Ingest workout from plain text

**Request:**
```http
POST /ingest/text
Content-Type: application/x-www-form-urlencoded

text=Incline Barbell Bench Press: 4 sets x 8 reps
Seated Cable Fly: 3 sets x 10-12 reps&source=manual_entry
```

**Response:**
```json
{
  "title": "Sample Chest & Triceps Workout",
  "source": "manual_entry",
  "blocks": [
    {
      "label": "Main Workout",
      "structure": "4 sets",
      "rest_between_sec": 90,
      "exercises": [
        {
          "name": "Incline Barbell Bench Press",
          "sets": 4,
          "reps": 8,
          "type": "strength",
          "notes": "Last set to failure; 45° incline; narrow grip; pause on chest."
        },
        {
          "name": "Seated Cable Fly",
          "sets": 3,
          "reps_range": "10-12",
          "type": "strength",
          "notes": "Slow negatives; elbows high; deep stretch."
        }
      ],
      "supersets": []
    }
  ]
}
```

---

### 3. POST /ingest/ai_workout
**Description:** Ingest AI/ChatGPT-generated workout

**Request:**
```http
POST /ingest/ai_workout
Content-Type: text/plain

Incline Barbell Bench Press: 4 sets x 8 reps
Seated Cable Fly: 3 sets x 10-12 reps
...
```

**Response:**
```json
{
  "title": "Sample Chest & Triceps Workout",
  "source": "ai_generated",
  "blocks": [...]
}
```

---

### 4. POST /ingest/image
**Description:** Ingest workout from image using OCR

**Request:**
```http
POST /ingest/image
Content-Type: multipart/form-data

file=<binary image file>
```

**Response:**
```json
{
  "title": "Sample Chest & Triceps Workout",
  "source": "image:workout.jpg",
  "blocks": [...]
}
```

---

### 5. POST /ingest/url
**Description:** Ingest workout from video URL

**Request:**
```http
POST /ingest/url
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=example"
}
```

**Response:**
```json
{
  "title": "YouTube Workout Title",
  "source": "https://www.youtube.com/watch?v=example",
  "blocks": [...]
}
```

---

### 6. POST /ingest/instagram_test
**Description:** Ingest workout from Instagram post (requires credentials)

**Request:**
```http
POST /ingest/instagram_test
Content-Type: application/json

{
  "username": "test_user",
  "password": "test_password",
  "url": "https://www.instagram.com/p/example/"
}
```

**Response:**
```json
{
  "title": "Instagram Workout",
  "source": "https://www.instagram.com/p/example/",
  "blocks": [...],
  "_provenance": {
    "mode": "instagram_image_test",
    "source_url": "https://www.instagram.com/p/example/",
    "image_count": 3
  }
}
```

---

### 7. POST /ingest/youtube
**Description:** Ingest workout from YouTube video using transcript

**Request:**
```http
POST /ingest/youtube
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=example"
}
```

**Response:**
```json
{
  "title": "YouTube Workout Title",
  "source": "https://www.youtube.com/watch?v=example",
  "blocks": [...],
  "_provenance": {
    "mode": "transcript_only",
    "source_url": "https://www.youtube.com/watch?v=example",
    "has_captions": true,
    "has_asr": false,
    "has_ocr": false,
    "transcript_provider": "youtube-transcript.io",
    "transcript_summarized": false
  }
}
```

---

### 8. POST /export/tp_text
**Description:** Export workout as Training Peaks text format

**Request:**
```http
POST /export/tp_text
Content-Type: application/json

{
  "title": "Sample Workout",
  "source": "example",
  "blocks": [...]
}
```

**Response:**
```text
Content-Type: text/plain

WORKOUT: Sample Chest & Triceps Workout

Main Workout
4 sets; 90 sec rest
  - Incline Barbell Bench Press: 4 x 8
  - Seated Cable Fly: 3 x 10-12
```

---

### 9. POST /export/tcx
**Description:** Export workout as TCX (Training Center XML) format

**Request:**
```http
POST /export/tcx
Content-Type: application/json

{
  "title": "Sample Workout",
  "source": "example",
  "blocks": [...]
}
```

**Response:**
```xml
Content-Type: application/vnd.garmin.tcx+xml

<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Workouts>
    <Workout>
      <Name>Sample Chest & Triceps Workout</Name>
      ...
    </Workout>
  </Workouts>
</TrainingCenterDatabase>
```

---

### 10. POST /export/fit
**Description:** Export workout as FIT format (binary)

**Request:**
```http
POST /export/fit
Content-Type: application/json

{
  "title": "Sample Workout",
  "source": "example",
  "blocks": [...]
}
```

**Response:**
```binary
Content-Type: application/octet-stream

<binary FIT file data>
```

---

## Data Models

### Workout
```json
{
  "title": "string",
  "source": "string (optional)",
  "blocks": [Block]
}
```

### Block
```json
{
  "label": "string (optional)",
  "structure": "string (optional)",
  "rest_between_sec": "number (optional)",
  "time_work_sec": "number (optional)",
  "default_reps_range": "string (optional)",
  "default_sets": "number (optional)",
  "exercises": [Exercise],
  "supersets": [Superset]
}
```

### Exercise
```json
{
  "name": "string",
  "sets": "number (optional)",
  "reps": "number (optional)",
  "reps_range": "string (optional)",
  "duration_sec": "number (optional)",
  "rest_sec": "number (optional)",
  "distance_m": "number (optional)",
  "distance_range": "string (optional)",
  "type": "string (default: 'strength')",
  "notes": "string (optional)"
}
```

### Superset
```json
{
  "exercises": [Exercise],
  "rest_between_sec": "number (optional)"
}
```

---

## MockAPI.io Configuration Tips

### Option 1: Using MockAPI.io Resources
MockAPI.io is resource-based. You can create resources like:
- `/health` - with GET method
- `/workouts` - POST to create workouts
- `/exports` - POST to export workouts

Then configure custom routes in the MockAPI.io dashboard to map:
- `GET /health` → Your health resource
- `POST /ingest/text` → Your workouts resource (with custom logic)

### Option 2: Using MockAPI.io Custom Routes
MockAPI.io supports custom route configuration. Set up routes for each endpoint above and define the response logic.

### Option 3: Manual Setup
1. For each endpoint above:
   - Create a resource in MockAPI.io
   - Configure the route path
   - Set up the HTTP method
   - Add example response data from `mockapi_examples.json`

---

## Testing with cURL

After setting up MockAPI.io endpoints, test them:

```bash
# Health check
curl -X GET https://<project_id>.mockapi.io/api/v1/health

# Ingest text
curl -X POST https://<project_id>.mockapi.io/api/v1/ingest/text \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "text=Bench Press: 3 sets x 10 reps&source=test"

# Ingest YouTube
curl -X POST https://<project_id>.mockapi.io/api/v1/ingest/youtube \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=example"}'
```

---

## Example Response Files

The script generates `mockapi_examples.json` with example responses for each endpoint. Use these as templates when configuring your MockAPI.io endpoints.

