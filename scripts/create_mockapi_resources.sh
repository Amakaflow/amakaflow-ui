#!/bin/bash
# Script to create all MockAPI.io resources at once using curl

BASE_URL="${MOCKAPI_BASE_URL:-https://6917363aa7a34288a27ff1d6.mockapi.io/api/v1}"

echo "=================================================================================="
echo "Creating MockAPI.io Resources"
echo "=================================================================================="
echo "Base URL: $BASE_URL"
echo ""

# Load examples from JSON file (we'll use jq or process inline)
EXAMPLES_FILE="$(dirname "$0")/../mockapi_examples.json"

if [ ! -f "$EXAMPLES_FILE" ]; then
    echo "ERROR: $EXAMPLES_FILE not found"
    exit 1
fi

# Create resources
create_resource() {
    local resource_name=$1
    local json_data=$2
    
    echo -n "Creating resource '$resource_name'... "
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        "$BASE_URL/$resource_name" \
        -H "Content-Type: application/json" \
        -d "$json_data")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        echo "✅ Success"
        return 0
    else
        echo "❌ Failed (HTTP $http_code)"
        echo "   Response: $body"
        return 1
    fi
}

# Create health resource
echo "Creating health resource..."
create_resource "health" '{"ok":true}' || true

# Create ingest_text resource
ingest_text_data=$(cat <<'EOF'
{
  "title": "Sample Chest & Triceps Workout",
  "source": "example",
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
EOF
)
create_resource "ingest_text" "$ingest_text_data" || true

# Create ingest_ai_workout resource (same structure as ingest_text)
create_resource "ingest_ai_workout" "$ingest_text_data" || true

# Create ingest_image resource (same structure)
create_resource "ingest_image" "$ingest_text_data" || true

# Create ingest_url resource (same structure)
create_resource "ingest_url" "$ingest_text_data" || true

# Create ingest_instagram_test resource
instagram_data=$(cat <<'EOF'
{
  "title": "Sample Chest & Triceps Workout",
  "source": "example",
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
  ],
  "_provenance": {
    "mode": "instagram_image_test",
    "source_url": "https://www.instagram.com/p/example/",
    "image_count": 3
  }
}
EOF
)
create_resource "ingest_instagram_test" "$instagram_data" || true

# Create ingest_youtube resource
youtube_data=$(cat <<'EOF'
{
  "title": "Sample Chest & Triceps Workout",
  "source": "example",
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
  ],
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
EOF
)
create_resource "ingest_youtube" "$youtube_data" || true

# Create export_tp_text resource (text format)
tp_text_data=$(cat <<'EOF'
{
  "content": "WORKOUT: Sample Chest & Triceps Workout\n\nMain Workout\n4 sets; 90 sec rest\n  - Incline Barbell Bench Press: 4 x 8\n  - Seated Cable Fly: 3 x 10-12",
  "type": "text"
}
EOF
)
create_resource "export_tp_text" "$tp_text_data" || true

# Create export_tcx resource (XML format)
tcx_data=$(cat <<'EOF'
{
  "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<TrainingCenterDatabase>\n  <Workouts>\n    <Workout>\n      <Name>Sample Chest & Triceps Workout</Name>\n    </Workout>\n  </Workouts>\n</TrainingCenterDatabase>",
  "type": "xml"
}
EOF
)
create_resource "export_tcx" "$tcx_data" || true

echo ""
echo "=================================================================================="
echo "✅ Done! All resources have been created."
echo "=================================================================================="
echo ""
echo "Your resources are now available at:"
echo "  GET/POST $BASE_URL/health"
echo "  GET/POST $BASE_URL/ingest_text"
echo "  GET/POST $BASE_URL/ingest_ai_workout"
echo "  GET/POST $BASE_URL/ingest_image"
echo "  GET/POST $BASE_URL/ingest_url"
echo "  GET/POST $BASE_URL/ingest_instagram_test"
echo "  GET/POST $BASE_URL/ingest_youtube"
echo "  GET/POST $BASE_URL/export_tp_text"
echo "  GET/POST $BASE_URL/export_tcx"
echo ""
echo "Refresh your MockAPI.io dashboard to see all the new resources!"

