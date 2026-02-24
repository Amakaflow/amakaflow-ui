"""
ICS (iCalendar) parser utility for parsing calendar feeds.
Handles Runna and other ICS-format calendar subscriptions.
"""
from datetime import datetime, date, time
from typing import List, Dict, Any, Optional
import re


def parse_ics_content(ics_content: str) -> List[Dict[str, Any]]:
    """
    Parse ICS content and return a list of events.

    Args:
        ics_content: Raw ICS file content as string

    Returns:
        List of event dictionaries with parsed data
    """
    events = []

    # Split into individual VEVENT blocks
    vevent_pattern = r'BEGIN:VEVENT(.*?)END:VEVENT'
    vevent_blocks = re.findall(vevent_pattern, ics_content, re.DOTALL)

    for block in vevent_blocks:
        event = parse_vevent_block(block)
        if event:
            events.append(event)

    return events


def parse_vevent_block(block: str) -> Optional[Dict[str, Any]]:
    """Parse a single VEVENT block into an event dictionary."""
    event = {}

    # Parse UID
    uid_match = re.search(r'UID:(.*?)(?:\r?\n)', block)
    if uid_match:
        event['uid'] = uid_match.group(1).strip()

    # Parse SUMMARY (title)
    summary_match = re.search(r'SUMMARY:(.*?)(?:\r?\n)', block)
    if summary_match:
        event['title'] = summary_match.group(1).strip()

    # Parse DESCRIPTION
    description_match = re.search(r'DESCRIPTION:(.*?)(?:\r?\n(?![ \t]))', block, re.DOTALL)
    if description_match:
        desc = description_match.group(1).strip()
        # Handle line folding (lines starting with space/tab)
        desc = re.sub(r'\r?\n[ \t]', '', desc)
        event['description'] = desc

    # Parse DTSTART (start date/time)
    dtstart_match = re.search(r'DTSTART:(\d{8}(?:T\d{6})?)', block)
    if dtstart_match:
        event['start'] = parse_ics_datetime(dtstart_match.group(1))

    # Parse DTEND (end date/time)
    dtend_match = re.search(r'DTEND:(\d{8}(?:T\d{6})?)', block)
    if dtend_match:
        event['end'] = parse_ics_datetime(dtend_match.group(1))

    # Parse custom Runna fields
    duration_match = re.search(r'X-WORKOUT-ESTIMATED-DURATION:(\d+)', block)
    if duration_match:
        event['estimated_duration'] = int(duration_match.group(1))

    timezone_match = re.search(r'X-USER-TIMEZONE:(.*?)(?:\r?\n)', block)
    if timezone_match:
        event['timezone'] = timezone_match.group(1).strip()

    # Parse location
    location_match = re.search(r'LOCATION:(.*?)(?:\r?\n)', block)
    if location_match:
        event['location'] = location_match.group(1).strip()

    # Determine workout type from UID and summary
    if 'uid' in event:
        event['is_completed'] = 'COMPLETED' in event['uid']
        event['is_plan_workout'] = 'PLAN_WORKOUT' in event['uid']

        # Extract workout type from summary emoji or UID
        if event.get('title'):
            event['workout_type'] = extract_workout_type(event['title'], event['uid'])

    return event if event else None


def parse_ics_datetime(dt_string: str) -> Dict[str, Any]:
    """
    Parse ICS datetime format (YYYYMMDD or YYYYMMDDTHHMMSS).

    Returns dict with 'date', and optionally 'time'.
    """
    result = {}

    if 'T' in dt_string:
        # Has time component
        dt = datetime.strptime(dt_string, '%Y%m%dT%H%M%S')
        result['date'] = dt.date()
        result['time'] = dt.time()
    else:
        # Date only
        dt = datetime.strptime(dt_string, '%Y%m%d')
        result['date'] = dt.date()

    return result


def extract_workout_type(title: str, uid: str) -> Optional[str]:
    """Extract workout type from title emoji or UID."""
    # Map Runna workout types from UID
    if '_EASY_RUN_' in uid or 'Easy Run' in title:
        return 'run'
    elif '_TEMPO_' in uid or 'Tempo' in title:
        return 'run'
    elif '_INTERVALS_' in uid or 'Repeats' in title or 'Intervals' in title:
        return 'run'
    elif '_LONG_RUN_' in uid or 'Long Run' in title:
        return 'run'
    elif '_RACE_' in uid or 'Race' in title:
        return 'run'
    elif 'HYROX' in title.upper():
        return 'hyrox'

    # Default to run for Runna
    return 'run'


def extract_distance_from_title(title: str) -> Optional[float]:
    """Extract distance in miles from title (e.g. '5.5mi Easy Run')."""
    match = re.search(r'(\d+(?:\.\d+)?)\s*mi', title)
    if match:
        return float(match.group(1))
    return None


def convert_to_workout_event(ics_event: Dict[str, Any], calendar_id: str, user_id: str) -> Dict[str, Any]:
    """
    Convert parsed ICS event to workout_events schema format.

    Args:
        ics_event: Parsed ICS event dict
        calendar_id: UUID of the connected calendar
        user_id: User ID who owns the calendar

    Returns:
        Dict ready to insert into workout_events table
    """
    start_info = ics_event.get('start', {})

    workout_event = {
        'user_id': user_id,
        'title': ics_event.get('title', 'Untitled Workout'),
        'date': start_info.get('date'),
        'source': 'runna',
        'type': ics_event.get('workout_type', 'run'),
        'status': 'completed' if ics_event.get('is_completed') else 'planned',
        'connected_calendar_id': calendar_id,
        'connected_calendar_type': 'runna',
        'external_event_url': extract_runna_url(ics_event.get('description', '')),
    }

    # Add start/end time if available
    if 'time' in start_info:
        workout_event['start_time'] = start_info['time']

    end_info = ics_event.get('end', {})
    if 'time' in end_info:
        workout_event['end_time'] = end_info['time']

    # Store full ICS data in json_payload
    workout_event['json_payload'] = {
        'ics_uid': ics_event.get('uid'),
        'description': ics_event.get('description'),
        'estimated_duration': ics_event.get('estimated_duration'),
        'location': ics_event.get('location'),
        'distance_mi': extract_distance_from_title(ics_event.get('title', '')),
    }

    return workout_event


def extract_runna_url(description: str) -> Optional[str]:
    """Extract Runna app URL from description."""
    match = re.search(r'https://club\.runna\.com/\S+', description)
    if match:
        return match.group(0)
    return None
