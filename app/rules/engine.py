"""
Training Rules Engine
Evaluates workout scheduling rules to optimize recovery and performance.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from enum import Enum
from datetime import date, timedelta


class RuleType(str, Enum):
    HARD = "hard"      # Must follow - safety/physiology
    SOFT = "soft"      # Should follow - optimization
    SUGGEST = "suggest"  # Nice to have - recommendations


class Condition(BaseModel):
    field: str
    operator: str  # ==, !=, >, <, >=, <=, in, contains
    value: Any


class RuleSuggestion(BaseModel):
    block_type: Optional[str] = None
    primary_muscle: Optional[str] = None
    intensity: Optional[int] = None
    duration: Optional[int] = None
    time_of_day: Optional[str] = None
    reason: str
    action: Optional[str] = None


class Prevention(BaseModel):
    block_type: Optional[str] = None
    primary_muscle: Optional[List[str]] = None
    intensity: Optional[List[int]] = None
    time_of_day: Optional[str] = None
    for_hours: Optional[int] = None


class Rule(BaseModel):
    id: Optional[str] = None
    rule_id: str
    name: str
    description: Optional[str] = None
    type: RuleType
    category: str
    version: int = 1
    enabled: bool = True
    conditions: List[Dict[str, Any]]
    prevents: List[Dict[str, Any]] = []
    suggests: List[Dict[str, Any]] = []
    reason: Optional[str] = None
    priority: int = 100


class RuleViolation(BaseModel):
    rule_id: str
    name: str
    type: RuleType
    reason: Optional[str]
    category: str


class RuleResult(BaseModel):
    violations: List[RuleViolation] = []  # Hard rules broken
    warnings: List[RuleViolation] = []    # Soft rules broken
    prevents: List[Dict[str, Any]] = []   # What NOT to schedule
    suggests: List[Dict[str, Any]] = []   # What TO schedule


class RulesEngine:
    """
    Evaluates training rules against workout context.
    
    Usage:
        engine = RulesEngine()
        engine.load_rules(rules_from_db)
        
        context = {
            "previous_day": {"block_type": "strength", "primary_muscle": "lower", "intensity": 3},
            "current_day": {"date": "2024-12-04"},
            "week": {"total_load": 850, "hard_sessions": 3},
            "user": {"experience_level": "intermediate"}
        }
        
        results = engine.evaluate(context)
    """
    
    def __init__(self):
        self.rules: List[Rule] = []
    
    def load_rules(self, rules_data: List[Dict[str, Any]]):
        """Load rules from database records"""
        self.rules = []
        for rule_data in rules_data:
            try:
                rule = Rule(**rule_data)
                if rule.enabled:
                    self.rules.append(rule)
            except Exception as e:
                print(f"Warning: Failed to load rule {rule_data.get('rule_id', 'unknown')}: {e}")
        
        # Sort by priority (higher priority first)
        self.rules.sort(key=lambda r: r.priority, reverse=True)
    
    def evaluate(self, context: Dict[str, Any]) -> RuleResult:
        """
        Evaluate all rules against the given context.
        
        Args:
            context: Dictionary containing:
                - previous_day: Previous day's workout data
                - current_day: Current day's data
                - week: Week statistics
                - user: User preferences and stats
        
        Returns:
            RuleResult with violations, warnings, prevents, and suggests
        """
        result = RuleResult()
        
        for rule in self.rules:
            if self._check_conditions(rule.conditions, context):
                violation = RuleViolation(
                    rule_id=rule.rule_id,
                    name=rule.name,
                    type=rule.type,
                    reason=rule.reason,
                    category=rule.category
                )
                
                if rule.type == RuleType.HARD:
                    result.violations.append(violation)
                    result.prevents.extend(rule.prevents)
                elif rule.type == RuleType.SOFT:
                    result.warnings.append(violation)
                
                # Add suggestions from all matching rules
                result.suggests.extend(rule.suggests)
        
        # Deduplicate suggestions
        result.suggests = self._deduplicate_suggestions(result.suggests)
        
        return result
    
    def _check_conditions(self, conditions: List[Dict[str, Any]], context: Dict[str, Any]) -> bool:
        """Check if ALL conditions match (AND logic)"""
        for cond in conditions:
            field = cond.get("field", "")
            operator = cond.get("operator", "==")
            expected = cond.get("value")
            
            actual = self._get_nested_value(context, field)
            
            if not self._compare(actual, operator, expected):
                return False
        
        return True
    
    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get value from nested dict using dot notation (e.g., 'previous_day.intensity')"""
        if not path:
            return None
            
        keys = path.split('.')
        current = data
        
        for key in keys:
            if isinstance(current, dict):
                current = current.get(key)
            else:
                return None
            
            if current is None:
                return None
        
        return current
    
    def _compare(self, actual: Any, operator: str, expected: Any) -> bool:
        """Compare values based on operator"""
        if actual is None:
            return False
        
        try:
            if operator == "==":
                return actual == expected
            elif operator == "!=":
                return actual != expected
            elif operator == ">":
                return actual > expected
            elif operator == "<":
                return actual < expected
            elif operator == ">=":
                return actual >= expected
            elif operator == "<=":
                return actual <= expected
            elif operator == "in":
                return actual in expected
            elif operator == "contains":
                if isinstance(actual, str):
                    return expected.lower() in actual.lower()
                elif isinstance(actual, list):
                    return expected in actual
                return False
            elif operator == "not_in":
                return actual not in expected
            else:
                return False
        except (TypeError, ValueError):
            return False
    
    def _deduplicate_suggestions(self, suggestions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate suggestions, keeping the first occurrence"""
        seen = set()
        unique = []
        
        for suggestion in suggestions:
            # Create a key based on block_type and primary_muscle
            key = (
                suggestion.get("block_type"),
                suggestion.get("primary_muscle"),
                suggestion.get("intensity")
            )
            
            if key not in seen:
                seen.add(key)
                unique.append(suggestion)
        
        return unique
    
    def check_workout_allowed(
        self, 
        context: Dict[str, Any], 
        proposed_workout: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Check if a proposed workout is allowed given the context.
        
        Args:
            context: Current training context
            proposed_workout: The workout being proposed
                - block_type: str
                - primary_muscle: str
                - intensity: int
        
        Returns:
            {
                "allowed": bool,
                "hard_violations": [...],
                "soft_violations": [...],
                "alternatives": [...]
            }
        """
        result = self.evaluate(context)
        
        # Check if proposed workout matches any prevention
        hard_violations = []
        soft_violations = []
        
        for prevent in result.prevents:
            if self._workout_matches_prevention(proposed_workout, prevent):
                # Find which rule caused this prevention
                for violation in result.violations:
                    hard_violations.append({
                        "rule": violation.name,
                        "reason": violation.reason
                    })
        
        for warning in result.warnings:
            soft_violations.append({
                "rule": warning.name,
                "reason": warning.reason
            })
        
        return {
            "allowed": len(hard_violations) == 0,
            "hard_violations": hard_violations,
            "soft_violations": soft_violations,
            "alternatives": result.suggests
        }
    
    def _workout_matches_prevention(
        self, 
        workout: Dict[str, Any], 
        prevention: Dict[str, Any]
    ) -> bool:
        """Check if a workout matches a prevention rule"""
        # Check block_type
        if prevention.get("block_type"):
            if workout.get("block_type") != prevention["block_type"]:
                return False
        
        # Check primary_muscle
        if prevention.get("primary_muscle"):
            muscles = prevention["primary_muscle"]
            if isinstance(muscles, list):
                if workout.get("primary_muscle") not in muscles:
                    return False
            else:
                if workout.get("primary_muscle") != muscles:
                    return False
        
        # Check intensity
        if prevention.get("intensity"):
            intensities = prevention["intensity"]
            if isinstance(intensities, list):
                if workout.get("intensity") not in intensities:
                    return False
            else:
                if workout.get("intensity") != intensities:
                    return False
        
        return True


def build_context_from_events(
    events: List[Dict[str, Any]], 
    target_date: date,
    user_preferences: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Build a rules engine context from calendar events.
    
    Args:
        events: List of workout events from the database
        target_date: The date we're planning for
        user_preferences: Optional user preferences
    
    Returns:
        Context dictionary for rules evaluation
    """
    previous_date = target_date - timedelta(days=1)
    week_start = target_date - timedelta(days=target_date.weekday())
    
    # Find previous day's events
    previous_day_events = [
        e for e in events 
        if e.get("date") == str(previous_date)
    ]
    
    # Find current day's events
    current_day_events = [
        e for e in events 
        if e.get("date") == str(target_date)
    ]
    
    # Calculate week statistics
    week_events = [
        e for e in events
        if week_start <= date.fromisoformat(e.get("date", "1970-01-01")) <= target_date
    ]
    
    # Build previous day context
    previous_day = {}
    if previous_day_events:
        # Take the most intense workout from previous day
        hardest = max(previous_day_events, key=lambda x: x.get("intensity", 0))
        previous_day = {
            "block_type": hardest.get("block_type") or hardest.get("type"),
            "primary_muscle": hardest.get("primary_muscle"),
            "intensity": hardest.get("intensity", 1),
            "title": hardest.get("title", ""),
            "has_run": any(e.get("block_type") == "run" or e.get("type") == "run" for e in previous_day_events),
        }
    
    # Build current day context
    current_day = {
        "date": str(target_date),
        "day_of_week": target_date.strftime("%A").lower(),
        "has_run": any(e.get("block_type") == "run" or e.get("type") == "run" for e in current_day_events),
        "events": current_day_events,
    }
    
    # If there's a morning session, add it
    am_events = [e for e in current_day_events if e.get("start_time", "12:00") < "12:00"]
    if am_events:
        hardest_am = max(am_events, key=lambda x: x.get("intensity", 0))
        current_day["am_session"] = {
            "intensity": hardest_am.get("intensity", 1),
            "block_type": hardest_am.get("block_type"),
        }
    
    # Build week context
    week = {
        "total_load": sum(e.get("load_score", 0) for e in week_events),
        "workouts_count": len(week_events),
        "hard_sessions": len([e for e in week_events if e.get("intensity", 0) >= 2]),
        "rest_days": 0,  # Would need to calculate from full week
        "day_number": (target_date - week_start).days + 1,
        "core_sessions": len([e for e in week_events if e.get("primary_muscle") == "core"]),
    }
    
    return {
        "previous_day": previous_day,
        "current_day": current_day,
        "week": week,
        "user": user_preferences or {},
    }
