"""
Utility functions for handling recurring events.
Expands RRULE recurrence patterns into individual event instances.
"""
from datetime import date, datetime, timedelta
from typing import List, Dict, Any
from dateutil.rrule import rrulestr


def expand_recurring_event(
    event: Dict[str, Any],
    start_date: date,
    end_date: date,
    max_instances: int = 365
) -> List[Dict[str, Any]]:
    """
    Expand a recurring event into individual instances within a date range.

    Args:
        event: The event dict with 'date', 'recurrence_rule', and other fields
        start_date: Start of date range to expand
        end_date: End of date range to expand
        max_instances: Maximum number of instances to generate (safety limit)

    Returns:
        List of event dicts, one for each occurrence
    """
    recurrence_rule = event.get('recurrence_rule')

    # If no recurrence rule, return single event if it falls in range
    if not recurrence_rule:
        event_date = event['date'] if isinstance(event['date'], date) else date.fromisoformat(str(event['date']))
        if start_date <= event_date <= end_date:
            return [event]
        return []

    # Parse the event's date
    event_date = event['date'] if isinstance(event['date'], date) else date.fromisoformat(str(event['date']))

    # Parse RRULE - ensure it has DTSTART
    rrule_str = recurrence_rule
    if not rrule_str.startswith('DTSTART'):
        # Add DTSTART from event date
        dtstart = f"DTSTART:{event_date.strftime('%Y%m%d')}\n"
        rrule_str = dtstart + rrule_str

    try:
        # Parse the recurrence rule
        rrule = rrulestr(rrule_str)

        # Generate occurrences between start_date and end_date
        # We need to check a bit before start_date in case the original event is before but has instances after
        check_from = min(event_date, start_date - timedelta(days=365))
        occurrences = list(rrule.between(
            datetime.combine(check_from, datetime.min.time()),
            datetime.combine(end_date, datetime.max.time()),
            inc=True
        ))[:max_instances]

        # Filter to only dates in our requested range and create event instances
        instances = []
        for occurrence_dt in occurrences:
            occurrence_date = occurrence_dt.date()
            if start_date <= occurrence_date <= end_date:
                # Create a copy of the event with the new date
                instance = event.copy()
                instance['date'] = occurrence_date
                # Add a field to indicate this is an expanded instance (optional, for tracking)
                if instance.get('json_payload') is None:
                    instance['json_payload'] = {}
                if isinstance(instance['json_payload'], dict):
                    instance['json_payload']['is_recurring_instance'] = True
                    instance['json_payload']['recurrence_date'] = occurrence_date.isoformat()
                instances.append(instance)

        return instances

    except Exception as e:
        # If parsing fails, log and return the original event if in range
        print(f"Warning: Failed to parse recurrence rule '{recurrence_rule}': {e}")
        if start_date <= event_date <= end_date:
            return [event]
        return []


def should_expand_recurring_event(event_date: date, recurrence_rule: str, start_date: date, end_date: date) -> bool:
    """
    Check if a recurring event might have instances in the requested date range.

    This is a quick check to avoid expanding events that definitely won't have instances.
    We're conservative here - better to expand and filter than to miss events.

    Args:
        event_date: The original event date
        recurrence_rule: The RRULE string
        start_date: Start of requested range
        end_date: End of requested range

    Returns:
        True if this event might have instances in the range
    """
    if not recurrence_rule:
        return False

    # If the event starts after the end of our range, it won't have instances
    if event_date > end_date:
        return False

    # For simplicity, we'll expand any event that:
    # 1. Starts before or during our date range
    # 2. Has a recurrence rule
    # This is conservative but safe - the expand function will filter properly
    return True
