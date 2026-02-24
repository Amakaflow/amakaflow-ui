from garmin_planner.__init__ import logger
from garmin_planner.constant import *
import yaml
import os
import re

dir_path = os.path.dirname(__file__)

def parseYaml(filename: str):
    filepath = os.path.join(dir_path, filename)
    data = {}
    with open(filepath) as stream:
        try:
            data = (yaml.safe_load(stream))
        except yaml.YAMLError as exc:
            logger.error(exc)
    return data
    

def parse_bracket(string):
    # Support optional category syntax: "Exercise Name [category: CATEGORY_NAME]"
    category_match = re.search(r'\[category:\s*([^\]]+)\]', string.lower())
    category = category_match.group(1).strip() if category_match else None
    # Remove the category part from the string before parsing
    string_clean = re.sub(r'\[category:\s*[^\]]+\]', '', string)
    
    # Support repeatUntilTime syntax: "repeatUntilTime(2100)" or "repeatUntilTime(35min)"
    if "repeatuntiltime" in string_clean.lower():
        match = re.search(r'repeatuntiltime\s*\(([^()]+)\)', string_clean.lower())
        if match:
            time_value = match.group(1).strip()
            # Convert to seconds if it's in minutes
            if "min" in time_value.lower():
                minutes = int(re.search(r'(\d+)', time_value).group(1))
                seconds = minutes * 60
            else:
                seconds = int(time_value)
            return "repeatuntiltime", seconds, category
    
    match = re.match(r"([\w@ \-']+)(?:\(([^()]+)\))?", string_clean.lower())
    if match:
        key = match.group(1).strip()  # Remove extra whitespace
        value = match.group(2)      
        return key, value, category
    return None, None, None

def parse_time_to_minutes(time_string):
    minutes, sec = map(int, time_string.split(":"))
    time_in_min = minutes + (sec / 60)
    return time_in_min

def parse_stepdetail(string):
    stepDetails = {}
    
    # Check for pipe-separated description (e.g., "lap | Description text")
    if "|" in string:
        parts = string.split("|", 1)
        detail_string = parts[0].strip()
        description = parts[1].strip()
        stepDetails['description'] = description
    else:
        detail_string = string
    
    details = detail_string.split(" ")
    prev_detail = None
    for detail in details:
        try:
            # Duration
            ## Time
            if ("sec" in detail):
                durationInSec = int(detail.replace("sec", ""))
                stepDetails.update({
                        'endCondition': ConditionType.TIME, 
                        'endConditionValue': durationInSec
                    })
                continue

            if (detail.endswith("s") and not detail.endswith("ms") and not "min" in detail):
                # Handle "60s" format (seconds)
                try:
                    durationInSec = int(detail.replace("s", ""))
                    stepDetails.update({
                            'endCondition': ConditionType.TIME, 
                            'endConditionValue': durationInSec
                        })
                    continue
                except ValueError:
                    pass

            if ("min" in detail and (detail.endswith("min") or detail.startswith("min"))):
                try:
                    durationNum = int(detail.replace("min", ""))
                    durationInSec = durationNum * 60
                    stepDetails.update({
                            'endCondition': ConditionType.TIME, 
                            'endConditionValue': durationInSec
                        })
                    continue
                except ValueError:
                    pass
            
            ## Distance
            if (detail.endswith("m") and len(detail) > 1):
                try:
                    distanceInMeter = int(detail.replace("m", ""))
                    stepDetails.update({
                            'endCondition': ConditionType.DISTANCE, 
                            'endConditionValue': distanceInMeter
                        })
                    continue
                except ValueError:
                    pass
            
            if ("k" in detail and "km" not in detail):
                distanceInMeter = int(detail.replace("k", "")) * 1000  # Convert kilometers to meters
                stepDetails.update({
                        'endCondition': ConditionType.DISTANCE, 
                        'endConditionValue': distanceInMeter
                    })
                continue

            ## Lap button
            if ("lap" in detail):
                stepDetails.update({
                        'endCondition': ConditionType.LAP_BUTTON, 
                        'endConditionValue': 30.0  # Garmin uses 30.0 for lap button
                    })
                continue
            
            ## Repetitions
            if ("reps" in detail):
                # Check if previous detail was a number
                if prev_detail:
                    try:
                        reps = int(prev_detail)
                        stepDetails.update({
                                'endCondition': ConditionType.REPS,  # Reps use REPS condition
                                'endConditionValue': reps
                            })
                    except ValueError:
                        pass
                continue

            # Target
            if ("@" in detail):
                target, value, _ = parse_bracket(detail)
                if (target == None or value == None):
                    continue

                ## Pace
                if (target.upper() == "@P"):
                    floor, top = value.split("-")
                    floorMin = parse_time_to_minutes(floor)
                    topMin = parse_time_to_minutes(top)
                    stepDetails.update({
                        'targetType': TargetType.PACE,
                        'targetValueOne': PACE_CONST/floorMin,
                        'targetValueTwo': PACE_CONST/topMin
                    })
                    continue

                ## Heart rate zone
                if (target.upper() == "@H"):
                    value = value.lower().replace("z", "")
                    rateZone = int(value)
                    stepDetails.update({
                        'targetType': TargetType.HEART_RATE_ZONE,
                        'zoneNumber': rateZone
                    })
                    continue

        except Exception as e:
            logger.error(e)
            continue
        
        prev_detail = detail

    return stepDetails