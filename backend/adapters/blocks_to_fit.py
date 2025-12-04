"""
Blocks to FIT Adapter v4

Uses repeat steps for sets (shows "3x" on watch).
"""

import struct
import time
from pathlib import Path
from io import BytesIO

try:
    from fastapi.responses import StreamingResponse
except ImportError:
    StreamingResponse = None

try:
    from backend.adapters.garmin_lookup import GarminExerciseLookup
    LOOKUP_PATH = Path(__file__).parent.parent.parent / "shared" / "dictionaries" / "garmin_exercises.json"
except ImportError:
    from garmin_lookup import GarminExerciseLookup
    LOOKUP_PATH = Path(__file__).parent / "garmin_exercises.json"

_lookup = None

def get_lookup():
    global _lookup
    if _lookup is None:
        _lookup = GarminExerciseLookup(str(LOOKUP_PATH))
    return _lookup


def crc16(data):
    crc_table = [
        0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
        0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400
    ]
    crc = 0
    for byte in data:
        tmp = crc_table[crc & 0xF]
        crc = (crc >> 4) & 0x0FFF
        crc = crc ^ tmp ^ crc_table[byte & 0xF]
        tmp = crc_table[crc & 0xF]
        crc = (crc >> 4) & 0x0FFF
        crc = crc ^ tmp ^ crc_table[(byte >> 4) & 0xF]
    return crc


def write_string(s, length):
    encoded = s.encode('utf-8')[:length-1]
    return encoded + b'\x00' * (length - len(encoded))


def parse_structure(structure_str):
    if not structure_str:
        return 1
    import re
    match = re.search(r'(\d+)', structure_str)
    return int(match.group(1)) if match else 1


def blocks_to_steps(blocks_json):
    lookup = get_lookup()
    steps = []
    
    for block in blocks_json.get('blocks', []):
        rounds = parse_structure(block.get('structure'))
        rest_between = block.get('rest_between_sec', 30) or 30
        
        all_exercises = []
        for superset in block.get('supersets', []):
            for exercise in superset.get('exercises', []):
                all_exercises.append(exercise)
        for exercise in block.get('exercises', []):
            all_exercises.append(exercise)
        
        for exercise in all_exercises:
            name = exercise.get('name', 'Exercise')
            reps = exercise.get('reps') or 10
            sets = exercise.get('sets') or rounds
            duration_sec = exercise.get('duration_sec')
            
            match = lookup.find(name)
            category_id = match['category_id']
            display_name = match.get('display_name') or match['category_name']
            
            start_index = len(steps)
            
            # Exercise step
            steps.append({
                'type': 'exercise',
                'display_name': display_name,
                'category_id': category_id,
                'intensity': 0,
                'duration_type': 29 if not duration_sec else 0,
                'duration_value': reps if not duration_sec else int(duration_sec * 1000),
            })
            
            # Rest step (if sets > 1)
            if sets > 1 and rest_between > 0:
                steps.append({
                    'type': 'rest',
                    'display_name': 'Rest',
                    'category_id': 0,
                    'intensity': 1,
                    'duration_type': 0,
                    'duration_value': int(rest_between * 1000),
                })
            
            # Repeat step (if sets > 1)
            if sets > 1:
                steps.append({
                    'type': 'repeat',
                    'duration_step': start_index,
                    'repeat_count': sets - 1,
                })
    
    return steps


def to_fit(blocks_json):
    title = blocks_json.get('title', 'Workout')[:31]
    steps = blocks_to_steps(blocks_json)
    
    if not steps:
        raise ValueError("No exercises found")
    
    data = b''
    timestamp = int(time.time()) - 631065600
    serial = timestamp & 0xFFFFFFFF
    
    # === file_id (local 0, global 0) ===
    data += struct.pack('<BBBHB', 0x40, 0, 0, 0, 5)
    data += struct.pack('<BBB', 3, 4, 0x8C)
    data += struct.pack('<BBB', 4, 4, 0x86)
    data += struct.pack('<BBB', 1, 2, 0x84)
    data += struct.pack('<BBB', 2, 2, 0x84)
    data += struct.pack('<BBB', 0, 1, 0x00)
    
    data += struct.pack('<B', 0x00)
    data += struct.pack('<I', serial)
    data += struct.pack('<I', timestamp)
    data += struct.pack('<H', 1)
    data += struct.pack('<H', 65534)
    data += struct.pack('<B', 5)
    
    # === file_creator (local 1, global 49) ===
    data += struct.pack('<BBBHB', 0x41, 0, 0, 49, 2)
    data += struct.pack('<BBB', 0, 2, 0x84)
    data += struct.pack('<BBB', 1, 1, 0x02)
    
    data += struct.pack('<B', 0x01)
    data += struct.pack('<H', 0)
    data += struct.pack('<B', 0)
    
    # === workout (local 2, global 26) ===
    data += struct.pack('<BBBHB', 0x42, 0, 0, 26, 5)
    data += struct.pack('<BBB', 4, 1, 0x00)
    data += struct.pack('<BBB', 5, 4, 0x8C)
    data += struct.pack('<BBB', 6, 2, 0x84)
    data += struct.pack('<BBB', 8, 32, 0x07)
    data += struct.pack('<BBB', 11, 1, 0x00)
    
    data += struct.pack('<B', 0x02)
    data += struct.pack('<B', 10)
    data += struct.pack('<I', 32)
    data += struct.pack('<H', len(steps))
    data += write_string(title, 32)
    data += struct.pack('<B', 20)
    
    # === workout_step for exercise/rest (local 3, global 27) ===
    data += struct.pack('<BBBHB', 0x43, 0, 0, 27, 8)
    data += struct.pack('<BBB', 254, 2, 0x84)  # message_index
    data += struct.pack('<BBB', 0, 4, 0x86)    # duration_value (field 0)
    data += struct.pack('<BBB', 1, 1, 0x00)    # duration_type
    data += struct.pack('<BBB', 2, 1, 0x00)    # target_type
    data += struct.pack('<BBB', 7, 1, 0x00)    # intensity
    data += struct.pack('<BBB', 10, 2, 0x84)   # exercise_category
    data += struct.pack('<BBB', 11, 2, 0x84)   # exercise_name
    data += struct.pack('<BBB', 19, 1, 0x02)   # unknown_19
    
    # === workout_step for repeat (local 4, global 27) ===
    # Fields: message_index, duration_step (field 2), repeat_steps (field 4), duration_type
    data += struct.pack('<BBBHB', 0x44, 0, 0, 27, 4)  # 4 fields
    data += struct.pack('<BBB', 254, 2, 0x84)  # message_index
    data += struct.pack('<BBB', 2, 4, 0x86)    # duration_step (reusing field 2)
    data += struct.pack('<BBB', 4, 4, 0x86)    # repeat_steps (reusing field 4)
    data += struct.pack('<BBB', 1, 1, 0x00)    # duration_type
    
    # Write workout steps
    for i, step in enumerate(steps):
        if step['type'] == 'repeat':
            data += struct.pack('<B', 0x04)  # local 4
            data += struct.pack('<H', i)
            data += struct.pack('<I', step['duration_step'])
            data += struct.pack('<I', step['repeat_count'])
            data += struct.pack('<B', 6)     # repeat_until_steps_cmplt
        else:
            data += struct.pack('<B', 0x03)  # local 3
            data += struct.pack('<H', i)
            data += struct.pack('<I', step['duration_value'])
            data += struct.pack('<B', step['duration_type'])
            data += struct.pack('<B', 2)     # target_type: open
            data += struct.pack('<B', step['intensity'])
            data += struct.pack('<H', step['category_id'])
            data += struct.pack('<H', 0)
            data += struct.pack('<B', 2 if step['type'] == 'rest' else 0)
    
    # === exercise_title (local 5, global 264) ===
    data += struct.pack('<BBBHB', 0x45, 0, 0, 264, 4)
    data += struct.pack('<BBB', 254, 2, 0x84)
    data += struct.pack('<BBB', 0, 2, 0x84)
    data += struct.pack('<BBB', 1, 2, 0x84)
    data += struct.pack('<BBB', 2, 32, 0x07)
    
    for i, step in enumerate(steps):
        if step['type'] == 'exercise':
            data += struct.pack('<B', 0x05)
            data += struct.pack('<H', i)
            data += struct.pack('<H', step['category_id'])
            data += struct.pack('<H', 0)
            data += write_string(step['display_name'], 32)
    
    data_crc = crc16(data)
    
    header = struct.pack('<BBHI4s', 14, 0x10, 0x527D, len(data), b'.FIT')
    header_crc = crc16(header)
    header += struct.pack('<H', header_crc)
    
    return header + data + struct.pack('<H', data_crc)


def to_fit_response(blocks_json, filename=None):
    if StreamingResponse is None:
        raise ImportError("FastAPI not installed")
    
    fit_bytes = to_fit(blocks_json)
    
    if filename is None:
        title = blocks_json.get('title', 'workout')
        filename = f"{title.replace(' ', '_')}.fit"
    
    return StreamingResponse(
        BytesIO(fit_bytes),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


if __name__ == "__main__":
    test_blocks = {
        "title": "Test Repeat Sets",
        "blocks": [{
            "structure": "3 rounds",
            "rest_between_sec": 30,
            "supersets": [{
                "exercises": [
                    {"name": "Push Ups", "reps": 10},
                    {"name": "Squats", "reps": 15}
                ]
            }]
        }]
    }
    
    fit_bytes = to_fit(test_blocks)
    print(f"Generated {len(fit_bytes)} bytes")
    
    with open("/tmp/test_repeat.fit", "wb") as f:
        f.write(fit_bytes)
    
    from fitparse import FitFile
    f = FitFile("/tmp/test_repeat.fit")
    
    print("\n=== WORKOUT ===")
    for record in f.get_messages('workout'):
        for field in record.fields:
            if field.name in ['wkt_name', 'num_valid_steps']:
                print(f"  {field.name}: {field.value}")
    
    print("\n=== STEPS (should show repeat structure) ===")
    for i, record in enumerate(f.get_messages('workout_step')):
        dur_type = None
        cat = None
        intensity = None
        repeat_steps = None
        dur_step = None
        for field in record.fields:
            if field.name == 'duration_type':
                dur_type = field.value
            if field.name == 'exercise_category':
                cat = field.value
            if field.name == 'intensity':
                intensity = field.value
            if field.name == 'repeat_steps':
                repeat_steps = field.value
            if field.name == 'duration_step':
                dur_step = field.value
        
        if dur_type == 'repeat_until_steps_cmplt':
            print(f"  {i+1}. REPEAT from step {dur_step}, {repeat_steps} more times (3x total)")
        elif intensity == 'rest':
            print(f"  {i+1}. REST")
        else:
            print(f"  {i+1}. {cat}")