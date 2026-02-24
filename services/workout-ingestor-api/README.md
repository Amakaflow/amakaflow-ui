# Workout Ingestor API

A FastAPI service that converts workout text, images, and videos into structured data (JSON, FIT, or TCX) compatible with Garmin and other fitness platforms.

## Quick start

```bash
# 1. Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# 4. Run the server
uvicorn workout_ingestor_api.main:app --reload
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `ENVIRONMENT` | No | `development`, `staging`, or `production` (default: `development`) |
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4o-mini vision/text |
| `ANTHROPIC_API_KEY` | No | Anthropic API key for Claude (optional fallback) |
| `HELICONE_ENABLED` | No | Enable Helicone AI gateway (`true`/`false`, default: `false`) |
| `HELICONE_API_KEY` | No | Helicone API key (required if `HELICONE_ENABLED=true`) |
| `SUPABASE_URL` | No | Supabase URL for caching |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key |
| `USE_LLM_NORMALIZER` | No | Enable LLM-based normalization (`true`/`false`, default: `false`) |

## Helicone Integration

The API supports [Helicone](https://helicone.ai) for AI observability:

- **Cost tracking**: Monitor OpenAI/Anthropic spend per request
- **Request logging**: Debug and audit AI calls
- **Analytics**: Usage patterns by feature, user, environment

To enable:
1. Sign up at [helicone.ai](https://helicone.ai)
2. Set `HELICONE_ENABLED=true`
3. Set `HELICONE_API_KEY=sk-helicone-...`

When disabled, AI calls go directly to OpenAI/Anthropic.

## API Endpoints

See `/docs` for interactive API documentation when running