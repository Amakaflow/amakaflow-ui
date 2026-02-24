"""
Smart Planner API Routes
Generates AI-powered workout suggestions based on rules engine.
"""

from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
from ..db import get_db_connection
from ..auth import get_current_user
from ..rules import RulesEngine, build_context_from_events, LLMRulesAdvisor

router = APIRouter()

# Initialize engines
rules_engine = RulesEngine()
llm_advisor = LLMRulesAdvisor()


class SmartPlanRequest(BaseModel):
    week_start: str  # YYYY-MM-DD
    user_goals: Optional[List[str]] = None
    include_llm_suggestions: bool = True


class SmartPlanResponse(BaseModel):
    week_start: str
    week_end: str
    hard_anchors: List[Dict[str, Any]]
    soft_anchors: List[Dict[str, Any]]
    existing_events: List[Dict[str, Any]]
    suggestions: List[Dict[str, Any]]
    daily_plans: List[Dict[str, Any]]
    violations: List[Dict[str, Any]]
    warnings: List[Dict[str, Any]]


def _load_rules_from_db() -> List[Dict[str, Any]]:
    """Load enabled rules from database"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT rule_id, name, description, type, category, 
                       version, enabled, conditions, prevents, suggests, 
                       reason, priority
                FROM training_rules
                WHERE enabled = TRUE
                ORDER BY priority DESC
            """)
            
            columns = [desc[0] for desc in cur.description]
            rules = []
            for row in cur.fetchall():
                rule = dict(zip(columns, row))
                rules.append(rule)
            
            return rules


def _get_user_events(user_id: str, start_date: str, end_date: str) -> List[Dict[str, Any]]:
    """Get user's calendar events for date range"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, title, date, start_time, end_time, type, source,
                       status, is_anchor, anchor_type, block_type, primary_muscle,
                       intensity, load_score, connected_calendar_id
                FROM workout_events
                WHERE user_id = %s AND date >= %s AND date <= %s
                ORDER BY date, start_time
            """, (user_id, start_date, end_date))
            
            columns = [desc[0] for desc in cur.description]
            events = []
            for row in cur.fetchall():
                event = dict(zip(columns, row))
                # Convert date/time to strings
                if event.get('date'):
                    event['date'] = str(event['date'])
                if event.get('start_time'):
                    event['start_time'] = str(event['start_time'])
                if event.get('end_time'):
                    event['end_time'] = str(event['end_time'])
                events.append(event)
            
            return events


def _get_user_preferences(user_id: str) -> Dict[str, Any]:
    """Get user preferences (placeholder for future)"""
    # TODO: Load from profiles table
    return {
        "experience_level": "intermediate",
        "preferred_workout_times": ["06:00", "17:00"],
        "max_workouts_per_day": 2
    }


@router.post("/smart-plan", response_model=SmartPlanResponse)
async def generate_smart_plan(
    request: SmartPlanRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Generate a smart workout plan for the week.
    
    Uses rules engine + optional LLM to:
    1. Identify hard anchors (unmoveable)
    2. Identify soft anchors (can be rescheduled)
    3. Evaluate rules for each day
    4. Generate suggestions to fill gaps
    """
    try:
        # Parse dates
        week_start = date.fromisoformat(request.week_start)
        week_end = week_start + timedelta(days=6)
        
        # Extend range to include previous week for context
        context_start = week_start - timedelta(days=7)
        
        # Load rules
        rules_data = _load_rules_from_db()
        rules_engine.load_rules(rules_data)
        
        # Get user's events
        events = _get_user_events(
            user_id,
            str(context_start),
            str(week_end)
        )

        # Get user preferences
        user_prefs = _get_user_preferences(user_id)
        
        # Separate anchors
        hard_anchors = [e for e in events if e.get('anchor_type') == 'hard']
        soft_anchors = [e for e in events if e.get('anchor_type') == 'soft']
        
        # Filter to just target week
        week_events = [
            e for e in events 
            if week_start <= date.fromisoformat(e['date']) <= week_end
        ]
        
        # Generate daily plans
        daily_plans = []
        all_suggestions = []
        all_violations = []
        all_warnings = []
        
        for day_offset in range(7):
            target_date = week_start + timedelta(days=day_offset)
            
            # Build context for this day
            context = build_context_from_events(
                events, 
                target_date,
                user_prefs
            )
            
            # Evaluate rules
            rule_results = rules_engine.evaluate(context)
            
            # Get day's events
            day_events = [
                e for e in week_events 
                if e['date'] == str(target_date)
            ]
            
            # Build daily plan
            daily_plan = {
                "date": str(target_date),
                "day_name": target_date.strftime("%A"),
                "events": day_events,
                "prevents": rule_results.prevents,
                "suggestions": rule_results.suggests,
                "has_violations": len(rule_results.violations) > 0,
                "has_warnings": len(rule_results.warnings) > 0
            }
            
            # Get LLM suggestions for days with gaps
            if request.include_llm_suggestions and len(day_events) < 2:
                try:
                    llm_suggestions = await llm_advisor.get_suggestions(
                        context,
                        {
                            "prevents": rule_results.prevents,
                            "suggests": rule_results.suggests
                        },
                        request.user_goals
                    )
                    
                    # Add date to each suggestion
                    for suggestion in llm_suggestions:
                        suggestion["date"] = str(target_date)
                        suggestion["source"] = "AI Recommendation"
                    
                    daily_plan["suggestions"].extend(llm_suggestions)
                    all_suggestions.extend(llm_suggestions)
                    
                except Exception as e:
                    print(f"LLM suggestion error for {target_date}: {e}")
            
            # Collect rule suggestions
            for suggestion in rule_results.suggests:
                suggestion["date"] = str(target_date)
                if "source" not in suggestion:
                    suggestion["source"] = "Rules Engine"
            all_suggestions.extend(rule_results.suggests)
            
            # Collect violations and warnings
            for v in rule_results.violations:
                all_violations.append({
                    "date": str(target_date),
                    "rule_id": v.rule_id,
                    "name": v.name,
                    "reason": v.reason
                })
            
            for w in rule_results.warnings:
                all_warnings.append({
                    "date": str(target_date),
                    "rule_id": w.rule_id,
                    "name": w.name,
                    "reason": w.reason
                })
            
            daily_plans.append(daily_plan)
        
        # Deduplicate suggestions
        seen = set()
        unique_suggestions = []
        for s in all_suggestions:
            key = (s.get("date"), s.get("block_type"), s.get("primary_muscle"))
            if key not in seen:
                seen.add(key)
                unique_suggestions.append(s)
        
        return SmartPlanResponse(
            week_start=str(week_start),
            week_end=str(week_end),
            hard_anchors=hard_anchors,
            soft_anchors=soft_anchors,
            existing_events=week_events,
            suggestions=unique_suggestions,
            daily_plans=daily_plans,
            violations=all_violations,
            warnings=all_warnings
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/check-workout")
async def check_workout_allowed(
    workout: Dict[str, Any],
    target_date: str,
    user_id: str = Depends(get_current_user)
):
    """
    Check if a proposed workout is allowed on a given date.

    Returns whether the workout violates any rules and
    suggests alternatives if not allowed.
    """
    try:
        target = date.fromisoformat(target_date)
        context_start = target - timedelta(days=7)

        # Load rules
        rules_data = _load_rules_from_db()
        rules_engine.load_rules(rules_data)

        # Get events for context
        events = _get_user_events(
            user_id,
            str(context_start),
            str(target)
        )
        
        # Build context
        context = build_context_from_events(events, target)
        
        # Check workout
        result = rules_engine.check_workout_allowed(context, workout)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rules")
async def get_rules(
    category: Optional[str] = None,
    rule_type: Optional[str] = None
):
    """
    Get all training rules, optionally filtered by category or type.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT rule_id, name, description, type, category,
                       conditions, prevents, suggests, reason, priority, enabled
                FROM training_rules
                WHERE 1=1
            """
            params = []
            
            if category:
                query += " AND category = %s"
                params.append(category)
            
            if rule_type:
                query += " AND type = %s"
                params.append(rule_type)
            
            query += " ORDER BY priority DESC"
            
            cur.execute(query, params)
            
            columns = [desc[0] for desc in cur.description]
            rules = [dict(zip(columns, row)) for row in cur.fetchall()]
            
            return {"rules": rules, "count": len(rules)}


@router.put("/rules/{rule_id}/toggle")
async def toggle_rule(
    rule_id: str,
    enabled: bool
):
    """
    Enable or disable a rule.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE training_rules
                SET enabled = %s, updated_at = NOW()
                WHERE rule_id = %s
                RETURNING rule_id, name, enabled
            """, (enabled, rule_id))
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="Rule not found")
            
            conn.commit()
            
            return {
                "rule_id": result[0],
                "name": result[1],
                "enabled": result[2]
            }
