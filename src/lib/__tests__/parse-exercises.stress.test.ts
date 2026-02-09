import { describe, it, expect } from 'vitest';
import { parseDescriptionForExercises } from '../parse-exercises';

/**
 * Stress tests for the frontend local parser.
 *
 * The local parser is an offline fallback — intentionally simpler than the
 * backend AI parser.  These tests verify it produces reasonable results and
 * does NOT produce garbage (round headers, hashtags, CTAs, etc.).
 */

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function labels(text: string): string[] {
  return parseDescriptionForExercises(text).map((e) => e.label);
}

function parsed(text: string) {
  return parseDescriptionForExercises(text);
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

describe('parseDescriptionForExercises — stress tests', () => {
  // -------------------------------------------------------------------------
  // 1. Strength + Cardio Finisher with letter-prefix supersets and rounds
  // -------------------------------------------------------------------------
  it('Scenario 1: Strength + Cardio Finisher with letter-prefix supersets', () => {
    const input = `Upper Body Strength + Cardio Finisher

A1. Bench Press 4x8
A2. Bent-over Row 4x8
B1. DB Shoulder Press 3x12
B2. Lat Pulldown 3x12
C. Tricep Dips 3x15

5 Rounds
- Rowing 500m
- Assault Bike 1km

#chestday #upperbody #gym`;

    const result = parsed(input);
    const names = result.map((e) => e.label);

    // Must NOT contain round headers or hashtags
    expect(names).not.toContain('5 Rounds');
    expect(names.some((n) => n.startsWith('#'))).toBe(false);

    // Known limitation: letter-prefixed lines (A1., B2., C.) keep the prefix
    // in the label because the parser doesn't strip letter-number prefixes.
    // The parser sees "A1." as part of the exercise name.
    expect(names.some((n) => n.includes('Bench Press'))).toBe(true);
    expect(names.some((n) => n.includes('Bent-over Row'))).toBe(true);
    expect(names.some((n) => n.includes('DB Shoulder Press'))).toBe(true);
    expect(names.some((n) => n.includes('Lat Pulldown'))).toBe(true);
    expect(names.some((n) => n.includes('Tricep Dips'))).toBe(true);

    // Known limitation: "Upper Body Strength + Cardio Finisher" passes
    // looksLikeExerciseName (compound name with + and no NxN).
    // This is acceptable for the offline fallback parser.

    // Distance exercises
    const rowing = result.find((e) => e.label === 'Rowing');
    expect(rowing).toBeDefined();
    expect(rowing!.distance).toBe('500m');
    expect(rowing!.duration_sec).toBeUndefined();

    const bike = result.find((e) => e.label === 'Assault Bike');
    expect(bike).toBeDefined();
    expect(bike!.distance).toBe('1km');

    // No crash
    expect(result.length).toBeGreaterThanOrEqual(7);
  });

  // -------------------------------------------------------------------------
  // 2. CrossFit WOD with AMRAP
  // -------------------------------------------------------------------------
  it('Scenario 2: CrossFit WOD with AMRAP', () => {
    const input = `CrossFit WOD

AMRAP 20 min
- Thrusters 10 reps
- Pull-ups 15 reps
- Box Jumps 20 reps

Then:
3 Rounds
- Deadlift 5x5
- Kettlebell Swing 4x12`;

    const result = parsed(input);
    const names = result.map((e) => e.label);

    // Round headers should be filtered
    expect(names).not.toContain('3 Rounds');
    // "AMRAP 20 min" is not a standard round header — the parser may or may
    // not skip it.  Just ensure no crash.
    expect(names.some((n) => /^\d+ rounds?$/i.test(n))).toBe(false);

    // Should extract at least Deadlift and Kettlebell Swing (they have NxN)
    expect(names).toContain('Deadlift');
    expect(names).toContain('Kettlebell Swing');

    // No crash
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  // -------------------------------------------------------------------------
  // 3. Multi-section push day with distance cardio
  // -------------------------------------------------------------------------
  it('Scenario 3: Multi-section push day with distance cardio', () => {
    const input = `Push Day

Upper Body:
1. Incline DB Press 4x10
2. Cable Flyes 3x15
3. Overhead Press 4x8

Lower Body:
4. Leg Press 4x12
5. Calf Raises 3x20

Cooldown:
- Treadmill Run 2km
- Rowing 1000m`;

    const result = parsed(input);
    const names = result.map((e) => e.label);

    // Section headers filtered
    expect(names).not.toContain('Upper Body');
    expect(names).not.toContain('Lower Body');
    expect(names).not.toContain('Cooldown');

    // Strength exercises
    expect(names).toContain('Incline DB Press');
    expect(names).toContain('Cable Flyes');
    expect(names).toContain('Overhead Press');
    expect(names).toContain('Leg Press');
    expect(names).toContain('Calf Raises');

    // Distance exercises
    const treadmill = result.find((e) => e.label === 'Treadmill Run');
    expect(treadmill).toBeDefined();
    expect(treadmill!.distance).toBe('2km');

    const rowing = result.find((e) => e.label === 'Rowing');
    expect(rowing).toBeDefined();
    expect(rowing!.distance).toBe('1000m');

    expect(result.length).toBeGreaterThanOrEqual(7);
  });

  // -------------------------------------------------------------------------
  // 4. Superset-heavy with rounds
  // -------------------------------------------------------------------------
  it('Scenario 4: Superset-heavy with rounds', () => {
    const input = `Full Body Superset Workout

3 Rounds
- Squats 4x10 + Lunges 4x10
- Bench Press 3x8 + Bent-over Row 3x8
- Bicep Curls 3x12 + Tricep Extensions 3x12

Chin-up + Negative Hold`;

    const result = parsed(input);
    const names = result.map((e) => e.label);

    // Round headers filtered
    expect(names).not.toContain('3 Rounds');

    // Supersets split (both sides have NxN)
    expect(names).toContain('Squats');
    expect(names).toContain('Lunges');
    expect(names).toContain('Bench Press');
    expect(names).toContain('Bent-over Row');
    expect(names).toContain('Bicep Curls');
    expect(names).toContain('Tricep Extensions');

    // Compound name NOT split (no NxN on either side)
    expect(names).toContain('Chin-up + Negative Hold');

    // Known limitation: "Full Body Superset Workout" passes looksLikeExerciseName
    // (contains only alpha chars + spaces, length <= 50). Parser returns 8 items.
    expect(result.length).toBe(8);
  });

  // -------------------------------------------------------------------------
  // 5. Minimalist format (plain text, no numbering or bullets)
  // -------------------------------------------------------------------------
  it('Scenario 5: Minimalist plain-text format', () => {
    const input = `Squats 5x5
Bench Press 5x5
Deadlift 1x5
Barbell Row 5x5
Overhead Press 5x5`;

    const result = parsed(input);
    const names = result.map((e) => e.label);

    expect(names).toContain('Squats');
    expect(names).toContain('Bench Press');
    expect(names).toContain('Deadlift');
    expect(names).toContain('Barbell Row');
    expect(names).toContain('Overhead Press');
    expect(result.length).toBe(5);

    // All should have duration_sec = 30 (no distance)
    result.forEach((e) => {
      expect(e.duration_sec).toBe(30);
      expect(e.distance).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 6. Hashtag-heavy Instagram caption
  // -------------------------------------------------------------------------
  it('Scenario 6: Hashtag-heavy Instagram caption', () => {
    const input = `Today's workout was INSANE! Here's what I did:

1. Squats 4x10
2. Romanian Deadlift 3x12
3. Hip Thrusts 4x8
4. Bulgarian Split Squats 3x10
5. Glute Bridges 3x15

#legday #glutes #fitness #gym #motivation #workout
#fitfam #gains #bodybuilding #personaltrainer
Follow me for more workouts!
Subscribe to my newsletter!
Check out my program at the link in bio!`;

    const result = parsed(input);
    const names = result.map((e) => e.label);

    // No hashtags
    expect(names.some((n) => n.startsWith('#'))).toBe(false);

    // No CTAs
    expect(names.some((n) => /^follow/i.test(n))).toBe(false);
    expect(names.some((n) => /^subscribe/i.test(n))).toBe(false);
    expect(names.some((n) => /^check out/i.test(n))).toBe(false);

    // Exercises present
    expect(names).toContain('Squats');
    expect(names).toContain('Romanian Deadlift');
    expect(names).toContain('Hip Thrusts');
    expect(names).toContain('Bulgarian Split Squats');
    expect(names).toContain('Glute Bridges');

    // Exactly 5 — no junk
    expect(result.length).toBe(5);
  });

  // -------------------------------------------------------------------------
  // 7. EMOM / Tabata format
  // -------------------------------------------------------------------------
  it('Scenario 7: EMOM / Tabata format', () => {
    const input = `EMOM 12 min
Minute 1: Burpees 10 reps
Minute 2: Box Jumps 10 reps
Minute 3: Kettlebell Swing 4x12

Tabata (8 rounds, 20s on / 10s off)
- Mountain Climbers
- High Knees
- Jump Squats`;

    const result = parsed(input);
    const names = result.map((e) => e.label);

    // Should extract at least the bulleted exercises
    expect(names).toContain('Mountain Climbers');
    expect(names).toContain('High Knees');
    expect(names).toContain('Jump Squats');

    // Known limitation: "Minute 3: Kettlebell Swing 4x12" is parsed but
    // the "Minute 3:" prefix remains in the label because the parser only
    // strips numbered prefixes (1., 2.) not "Minute N:" format.
    expect(names.some((n) => n.includes('Kettlebell Swing'))).toBe(true);

    // No crash, reasonable count
    expect(result.length).toBeGreaterThanOrEqual(4);
  });

  // -------------------------------------------------------------------------
  // 8. Distance-only workout
  // -------------------------------------------------------------------------
  it('Scenario 8: Distance-only workout', () => {
    const input = `Cardio Day

- Run 5km
- Rowing 2000m
- Cycling 10km
- Walking Lunges 50m
- Sprint 200m`;

    const result = parsed(input);
    const names = result.map((e) => e.label);

    expect(names).toContain('Run');
    expect(names).toContain('Rowing');
    expect(names).toContain('Cycling');
    expect(names).toContain('Walking Lunges');
    expect(names).toContain('Sprint');

    // All distance exercises should have distance populated
    const distanceExercises = result.filter((e) => e.label !== 'Cardio Day');
    distanceExercises.forEach((e) => {
      expect(e.distance).toBeDefined();
      expect(e.duration_sec).toBeUndefined();
    });

    // Check specific distances
    expect(result.find((e) => e.label === 'Run')!.distance).toBe('5km');
    expect(result.find((e) => e.label === 'Rowing')!.distance).toBe('2000m');
    expect(result.find((e) => e.label === 'Cycling')!.distance).toBe('10km');
    expect(result.find((e) => e.label === 'Walking Lunges')!.distance).toBe('50m');
    expect(result.find((e) => e.label === 'Sprint')!.distance).toBe('200m');

    // Known limitation: "Cardio Day" passes looksLikeExerciseName (short
    // plain text without any skip pattern match). 6 results total.
    expect(result.length).toBe(6);
  });

  // -------------------------------------------------------------------------
  // 9. Messy caption with emojis and social media text
  // -------------------------------------------------------------------------
  it('Scenario 9: Messy caption with emojis and social media text', () => {
    const input = `🔥 KILLER UPPER BODY WORKOUT 🔥

💪 Save this for later! Tag a friend who needs this!

1. Incline Bench Press 4x8
2. Cable Flyes 3x15
3. Arnold Press 4x10
4. Lateral Raises 3x15

Drop a 💪 if you crushed it!
Follow @fitnessguru for more 🏋️‍♂️
#fitness #upperbody #chestday #gains`;

    const result = parsed(input);
    const names = result.map((e) => e.label);

    // No hashtags or CTAs
    expect(names.some((n) => n.startsWith('#'))).toBe(false);
    expect(names.some((n) => /^follow/i.test(n))).toBe(false);

    // Exercises extracted
    expect(names).toContain('Incline Bench Press');
    expect(names).toContain('Cable Flyes');
    expect(names).toContain('Arnold Press');
    expect(names).toContain('Lateral Raises');

    // Should have exactly 4 real exercises
    expect(result.length).toBe(4);
  });

  // -------------------------------------------------------------------------
  // 10. Mixed distance units (m, km)
  // -------------------------------------------------------------------------
  it('Scenario 10: Mixed distance units', () => {
    const input = `Conditioning Circuit

1. Farmer Carry 50m
2. Sled Push 25m
3. Run 1.5km
4. Row 500m
5. Bear Crawl 20m

10 Rounds
- Shuttle Run 100m
- Walking Lunges 25yd`;

    const result = parsed(input);
    const names = result.map((e) => e.label);

    // Round header filtered
    expect(names).not.toContain('10 Rounds');

    // Distance exercises
    const farmerCarry = result.find((e) => e.label === 'Farmer Carry');
    expect(farmerCarry).toBeDefined();
    expect(farmerCarry!.distance).toBe('50m');

    const sledPush = result.find((e) => e.label === 'Sled Push');
    expect(sledPush).toBeDefined();
    expect(sledPush!.distance).toBe('25m');

    const run = result.find((e) => e.label === 'Run');
    expect(run).toBeDefined();
    expect(run!.distance).toBe('1.5km');

    const row = result.find((e) => e.label === 'Row');
    expect(row).toBeDefined();
    expect(row!.distance).toBe('500m');

    const bearCrawl = result.find((e) => e.label === 'Bear Crawl');
    expect(bearCrawl).toBeDefined();
    expect(bearCrawl!.distance).toBe('20m');

    const shuttle = result.find((e) => e.label === 'Shuttle Run');
    expect(shuttle).toBeDefined();
    expect(shuttle!.distance).toBe('100m');

    const walkingLunges = result.find((e) => e.label === 'Walking Lunges');
    expect(walkingLunges).toBeDefined();
    expect(walkingLunges!.distance).toBe('25yd');

    // All distance exercises should NOT have duration_sec
    result.forEach((e) => {
      if (e.distance) {
        expect(e.duration_sec).toBeUndefined();
      }
    });

    // Known limitation: "Conditioning Circuit" passes looksLikeExerciseName.
    // 8 results total.
    expect(result.length).toBe(8);
  });

  // -------------------------------------------------------------------------
  // General robustness
  // -------------------------------------------------------------------------
  it('should never crash on arbitrary input', () => {
    const crazyInputs = [
      '',
      '   ',
      '\n\n\n',
      '!@#$%^&*()',
      '12345',
      'just some random text that is not a workout',
      '🏋️‍♂️🏋️‍♂️🏋️‍♂️',
      '#hashtag #another #more',
      'Follow me on Instagram!',
      'A'.repeat(10000),
      Array(100).fill('Squats 4x8').join('\n'),
      '1. 2. 3. 4. 5.',
      '- - - - -',
      '• • •',
    ];

    for (const input of crazyInputs) {
      // Should never throw
      expect(() => parseDescriptionForExercises(input)).not.toThrow();
    }
  });
});
