"""Consolidated workout-parse prompt builder for all platforms (AMA-747).

Previously, near-identical prompts lived independently in:
  - InstagramReelService._parse_transcript  (richest version — used as the base)
  - UnifiedParser.parse                     (copied from Instagram with minor drift)

Any bug fix or improvement now only needs to happen here.

Usage::

    from workout_ingestor_api.services.prompts.workout_parse_prompt import build_prompt

    prompt = build_prompt(
        platform="instagram",
        video_duration_sec=90,
        raw_text=caption_or_transcript,
        secondary_texts=["description paragraph", "chapter list"],
    )
"""
from __future__ import annotations

from typing import List, Optional


# ---------------------------------------------------------------------------
# Platform preambles — must be distinct and platform-accurate
# ---------------------------------------------------------------------------

_PLATFORM_PREAMBLES: dict[str, str] = {
    "instagram": (
        "You are a fitness expert who extracts structured workout information "
        "from Instagram Reel captions and transcripts. "
        "Instagram workout content is often condensed into short captions with hashtags, "
        "or spoken aloud in 15–90 second reels. Focus on the exercise details embedded "
        "in both the caption text and any available transcript."
    ),
    "youtube": (
        "You are a fitness expert who extracts structured workout information "
        "from YouTube video descriptions, chapter titles, and auto-generated transcripts. "
        "YouTube workout videos often include detailed written descriptions with timestamps, "
        "named workout phases, and explicit sets/reps. Chapter titles are particularly "
        "reliable signals for block boundaries."
    ),
    "tiktok": (
        "You are a fitness expert who extracts structured workout information "
        "from TikTok video captions and on-screen text transcripts. "
        "TikTok workout content is typically very short (15–60 seconds), "
        "highly abbreviated, and may use slang, emoji, or text-overlay formats. "
        "Prioritise on-screen text over audio transcripts when both are available."
    ),
    "pinterest": (
        "You are a fitness expert who extracts structured workout information "
        "from Pinterest pin descriptions and linked article excerpts. "
        "Pinterest workout content is usually static text — infographic descriptions, "
        "numbered exercise lists, or blog excerpts. There is no video transcript; "
        "rely entirely on the written description provided."
    ),
}

_DEFAULT_PREAMBLE = (
    "You are a fitness expert who extracts structured workout information "
    "from social-media captions and video transcripts."
)


def _get_preamble(platform: str) -> str:
    """Return the platform-specific opening sentence(s)."""
    return _PLATFORM_PREAMBLES.get(platform.lower(), _DEFAULT_PREAMBLE)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def build_prompt(
    platform: str,
    video_duration_sec: Optional[float],
    raw_text: str,
    secondary_texts: Optional[List[str]] = None,
    title: Optional[str] = None,
) -> str:
    """Build the unified workout-parse LLM prompt.

    Args:
        platform: Source platform identifier — "instagram", "youtube", "tiktok",
            "pinterest", or any other string (falls back to a generic preamble).
        video_duration_sec: Total video length in seconds, or ``None`` when not
            available (e.g. Pinterest pins, text-only sources).
        raw_text: Primary text to parse — caption, transcript, or description.
        secondary_texts: Optional additional text snippets (e.g. YouTube chapter
            list, description, on-screen overlay text).  Each entry is appended
            in its own labelled section so the LLM can distinguish sources.
        title: Optional workout title sourced from the platform (e.g. video
            title, pin title).  When provided it is included in the prompt
            header so the LLM can use it as a structural signal.

    Returns:
        A fully-formed prompt string ready to pass to any OpenAI-compatible
        chat-completion endpoint.
    """
    preamble = _get_preamble(platform)

    # Duration context inserted into the focus list item
    if video_duration_sec is not None:
        duration_context = (
            f"\nThe video is {int(video_duration_sec)} seconds long "
            f"({int(video_duration_sec) // 60} minutes {int(video_duration_sec) % 60} seconds). "
            f"Estimate the approximate start time in seconds for each exercise "
            f"based on when it's discussed in the transcript."
        )
    else:
        duration_context = ""

    # Build secondary-text section (new — was ignored by UnifiedParser)
    secondary_section = ""
    if secondary_texts:
        parts: list[str] = []
        for i, text in enumerate(secondary_texts, start=1):
            parts.append(f"[Additional source {i}]\n{text}")
        secondary_section = "\n\n" + "\n\n".join(parts)

    # video_duration_sec placeholder for the JSON response format footer
    vd_placeholder = int(video_duration_sec) if video_duration_sec is not None else "null"

    # Build optional title line for the prompt header
    title_line = f"Title: {title}\n" if title is not None else ""

    prompt = f"""{preamble}

Analyze this text and extract the workout routine being described. Focus on:
1. Exercise names (standardize to common names)
2. Sets and reps (extract specific numbers when mentioned)
3. Important form cues and technique notes
4. Rest periods if mentioned
5. Detecting CIRCUITS and ROUNDS — see rules below (check AFTER keyword override)
6. Detecting SUPERSETS — see rules below (check SECOND, only if not a circuit)
7. Approximate timestamp in the video where each exercise is discussed{duration_context}

Platform: {platform}
{title_line}Text to parse:
---
{raw_text}
---{secondary_section}

KEYWORD STRUCTURE OVERRIDE — HIGHEST PRIORITY (check before everything else):
If the block label or workout title contains any of these keywords (case-insensitive), you MUST use that exact structure — it overrides all other heuristics:
- "EMOM" → structure: "emom", time_work_sec: 60 (1 min per station), set rounds to the round count if given
- "AMRAP" → structure: "amrap", time_cap_sec: the stated time in seconds if given
- "Tabata" → structure: "tabata", time_work_sec: 20, time_rest_sec: 10 unless stated otherwise
- "For Time" → structure: "for-time"
Keyword match = structure_confidence: 1.0, structure_options: []

EMOM FIELDS:
- "rounds": number of times through all exercises (e.g. 6 rounds)
- "time_cap_sec": total workout time in seconds, if a total duration is stated (e.g. "30 min EMOM" → 1800, "EMOM x 30 mins" → 1800, "EMOM x 20 minutes" → 1200). Convert any stated duration to seconds.
- "time_work_sec": 60 (one minute per station — the definition of EMOM)
- Set time_work_sec and time_cap_sec to null when not determinable

CIRCUIT / ROUNDS DETECTION — CHECK AFTER KEYWORD OVERRIDE:
A circuit or rounds-based workout is 3+ exercises done in sequence, repeated for N rounds. Detect when:
- Text mentions "N rounds", "N rounds of", "repeat N times", "x N rounds"
- Text lists 3 or more exercises to be done in order, then repeated
- Workout styles like HYROX, CrossFit WODs are often circuits — but check for EMOM/AMRAP/Tabata/For Time keywords FIRST
- If there are 3+ exercises and a round count with no EMOM/AMRAP keyword, it is a CIRCUIT

When you detect a circuit:
- Set structure to "circuit"
- Put ALL exercises in the "exercises" array (NOT in supersets)
- Set "rounds" to the number of rounds
- Set "sets" on each exercise to null (rounds handle repetition)
- Use "distance_m" for distance-based exercises (e.g. 500m ski = distance_m: 500)
- Use "calories" for calorie-target exercises (e.g. "16 cal row" = calories: 16)
- "supersets" MUST be [] (empty)

STRAIGHT SETS vs CIRCUIT — KEY DISTINCTION:
- STRAIGHT SETS (structure: null): Each exercise has its own independent set count. The athlete completes all sets of one exercise before moving to the next. Do NOT classify as circuit.
- CIRCUIT (structure: "circuit"): ALL exercises are performed back-to-back in sequence, then the ENTIRE group repeats for N rounds. Requires EXPLICIT "rounds" language applied to the group.
- Individual per-exercise set counts (sets: 3) are NOT circuit rounds.
- Only set structure: "circuit" when explicit "rounds" language applies to the whole group of exercises together.

TIMED STATION FORMAT — CHECK AFTER CIRCUIT/Rounds AND BEFORE SUPERSET:
When the workout uses a timed-station format with "X minute window" or timestamp ranges (e.g. "In a 5 minute window complete:" or "0-5: 1000m Ski"):
- Set "rounds" to 1 (one pass through all stations)
- Set "time_cap_sec" on the block to the window duration in seconds (e.g. "5 minute window" = 300 seconds, "10 minute window" = 600 seconds)
- Set "time_cap_sec" on EACH exercise to the same window duration — every station has its own time cap
- Each line starts with "MM-MM:" which is a MINUTE timestamp range (e.g. "0-5:" means minutes 0-5) — NEVER use this as reps, sets, or rounds
- Extract the actual exercise metrics from the text AFTER the colon only
- DISTANCE RULE: If the metric has an "m" suffix (e.g. "1000m Ski", "80m Burpee", "100m Walking Lunge"), use distance_m — NEVER reps or duration_sec
- REPS RULE: If the metric has NO unit suffix (e.g. "100 Wall Balls"), use reps
- NEVER set duration_sec on individual exercises in a timed-station format
- NEVER put "X minute cap" or time information in the notes field — time_cap_sec captures this; notes is for form cues only

Example: "In a 5 minute window complete: 0-5: 1000m Ski, 5-10: 50m Sled Push, 15-20: 80m Burpee Broad Jumps, 35-40: 100 Wall Balls"
{{
  "label": "5 Minute Window",
  "structure": "circuit",
  "rounds": 1,
  "time_cap_sec": 300,
  "structure_confidence": 1.0,
  "structure_options": [],
  "exercises": [
    {{"name": "Ski Erg", "distance_m": 1000, "duration_sec": null, "reps": null, "time_cap_sec": 300, "notes": null, "type": "cardio"}},
    {{"name": "Sled Push", "distance_m": 50, "duration_sec": null, "reps": null, "time_cap_sec": 300, "notes": null, "type": "strength"}},
    {{"name": "Burpee Broad Jumps", "distance_m": 80, "duration_sec": null, "reps": null, "time_cap_sec": 300, "notes": null, "type": "strength"}},
    {{"name": "Wall Balls", "distance_m": null, "duration_sec": null, "reps": 100, "time_cap_sec": 300, "notes": null, "type": "strength"}}
  ],
  "supersets": []
}}

CONFIDENCE SCORING — INCLUDE IN EVERY BLOCK:
- "structure_confidence": float 0.0–1.0 — your confidence in the "structure" field
- "structure_options": list[str] — required when structure_confidence < 0.8; empty list [] when confidence >= 0.8

Confidence scale:
- 1.0   : unambiguous keyword signal ("AMRAP", "EMOM", "For Time", "Tabata", "3 rounds", "repeat N times", explicit round count like "x4")
- 0.85–0.99: exercises with explicit sets and reps but no grouping/round signal — clearly straight sets
- 0.8   : moderately confident — use for borderline cases where structure is likely correct but not certain
- 0.5–0.79: ambiguous — two structures are plausible (e.g. could be circuit or superset; set structure_options accordingly)
- 0.3–0.49: very ambiguous — exercises listed with no sets, no reps, and no round/repeat signal
- 0.0–0.29: reserved for extreme ambiguity; use sparingly

When structure_confidence < 0.8, you MUST populate structure_options with the plausible alternative structure values.

SUPERSET DETECTION — CHECK ONLY IF NOT A CIRCUIT:
Supersets are EXACTLY 2 exercises paired back-to-back. Detect when:
- Two exercises appear on the SAME LINE separated by "and", "&", "/", or "+"
- Exercises are labeled A1/A2, B1/B2, etc.
- Exercises are explicitly called "superset" or "paired with"
- ONLY use superset when exercises come in pairs of 2 — never for 3+ exercises in a round

CRITICAL RULE — DO NOT VIOLATE:
When structure is "superset", the "exercises" array MUST be empty []. ALL exercises go inside "supersets" only.
NEVER put the same exercise in both "exercises" and "supersets". This is the #1 most common mistake.

REPS PARSING RULES:
- If reps are given as a specific number (e.g. "10 reps", "do 8"), set "reps" to that number and "reps_range" to null
- If reps are given as a range (e.g. "6-8 reps", "8-12", "6-8 each leg", "6 to 8"), set "reps" to null and "reps_range" to the exact range string as written (e.g. "6-8 each leg")
- Never guess a reps number — if unclear, set both "reps" and "reps_range" to null
- "X4 Rounds", "x4", "x 4" shorthand means rounds: 4 on the block — not sets on exercises
- When caption lines use timed-station format ("MM-MM: <exercise>"), the "MM-MM:" prefix is a minute-range timestamp — it is NEVER reps or sets. Extract metrics from the text after the colon only:
  - "35-40: 100 wall balls" -> reps: 100 (the 100 IS the rep count)
  - "0-5: 1000m Ski" -> distance_m: 1000
  - "25-30: 200m farmers carry" -> distance_m: 200
  The leading "MM-MM:" numbers must NEVER be used as reps, sets, or distance.

NOTES FOR TIMED STATION FORMAT:
When the workout is detected as timed-station (caption uses "MM-MM:" format or "in a X minute window"):
- Set each exercise's "notes" to reflect the time window, e.g. "5 minute cap"
- Do NOT use "Complete as fast as possible" for timed-station exercises
- Format: "<N> minute cap" where N is the window duration

Return ONLY a valid JSON object.

STRUCTURE FOR CIRCUIT / ROUNDS BLOCKS (3+ exercises, repeated):
{{
  "label": "HYROX Conditioning",
  "structure": "circuit",
  "rounds": 5,
  "structure_confidence": 1.0,
  "structure_options": [],
  "exercises": [
    {{
      "name": "Ski Erg",
      "sets": null,
      "reps": null,
      "distance_m": 500,
      "calories": null,
      "type": "cardio",
      "notes": "Steady pace"
    }},
    {{
      "name": "Rowing",
      "sets": null,
      "reps": null,
      "distance_m": null,
      "calories": 16,
      "type": "cardio",
      "notes": "16 cal"
    }},
    {{
      "name": "Wall Balls",
      "sets": null,
      "reps": 20,
      "distance_m": null,
      "calories": null,
      "type": "strength",
      "notes": "9kg ball"
    }}
  ],
  "supersets": []
}}

STRUCTURE FOR NON-SUPERSET, NON-CIRCUIT BLOCKS (straight sets):
{{
  "label": "Block Name",
  "structure": null,
  "structure_confidence": 0.85,
  "structure_options": [],
  "exercises": [
    {{
      "name": "Exercise Name",
      "sets": 3,
      "reps": null,
      "reps_range": "6-8",
      "duration_sec": null,
      "rest_sec": null,
      "distance_m": null,
      "calories": null,
      "type": "strength",
      "notes": "Form cues here",
      "video_start_sec": 5,
      "video_end_sec": 30
    }}
  ],
  "supersets": []
}}

STRUCTURE FOR SUPERSET BLOCKS (exactly 2 exercises paired):
{{
  "label": "Strength Supersets",
  "structure": "superset",
  "structure_confidence": 1.0,
  "structure_options": [],
  "exercises": [],
  "supersets": [
    {{
      "exercises": [
        {{"name": "Exercise A", "sets": 5, "reps": 5, "calories": null, "type": "strength"}},
        {{"name": "Exercise B", "sets": 5, "reps": 5, "calories": null, "type": "strength"}}
      ]
    }}
  ]
}}
NOTE: "exercises" is [] (empty) above. This is mandatory when structure is "superset".

Full response format:
{{
  "title": "<title extracted from the text>",
  "workout_type": "strength | circuit | hiit | cardio | follow_along | mixed",
  "workout_type_confidence": 0.0-1.0,
  "video_duration_sec": {vd_placeholder},
  "blocks": [
    {{
      "label": "...",
      "structure": "...",
      "structure_confidence": 0.0-1.0,
      "structure_options": [],
      "rounds": null,
      "exercises": [ ... ],
      "supersets": []
    }}
  ]
}}

Rules:
- Only include actual exercises mentioned, not random sentences
- If a block has no exercises AND no supersets, do NOT include it in the output. Every block must contain at least one exercise or superset.
- If sets/reps aren't stated, use reasonable defaults (3-4 sets, 8-12 reps for strength)
- Include helpful notes from the transcript about form, tempo, or technique
- Standardize exercise names (e.g. "RDLS" → "Romanian Deadlifts")
- FIRST check for EMOM/AMRAP/Tabata/For Time keywords (highest priority)
- THEN check for circuits/rounds (3+ exercises repeated) — these are NOT supersets
- THEN check for supersets (exactly 2 exercises paired on same line)
- For circuits: put ALL exercises in "exercises", set "rounds", leave "supersets" empty
- For supersets: put ALL exercises in "supersets", leave "exercises" empty
- NEVER put exercises in BOTH "exercises" and "supersets" — pick one or the other per block
- Use multiple blocks only if the text describes truly distinct sections (e.g. "Warm-up" vs "Main work")
- Use "distance_m" for distance-based exercises (500m, 25m, 2.5km = 2500, etc.)
- Use "calories" for calorie-target exercises (rowing machine, ski erg, air bike measured in cals)
- Never put a calorie target in "distance_m" — use "calories" field instead
- For video_start_sec/video_end_sec: estimate when each exercise is discussed
- Return ONLY JSON, no markdown, no code blocks"""

    return prompt
