/**
 * AMA-120: Client-side TCX (Training Center XML) export for workouts.
 *
 * Generates TCX format files compatible with TrainingPeaks, Garmin Connect,
 * and other fitness platforms that support the Training Center Database format.
 *
 * Reference: https://developer.garmin.com/fit/file-types/tcx/
 */

import type { WorkoutStructure, Block, Exercise } from '../types/workout';

/**
 * Escape XML special characters.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Map workout type/category to TCX sport type.
 * TCX supports: Running, Biking, Other
 */
function workoutToTcxSport(workout: WorkoutStructure): string {
  const type = workout.workout_type;
  if (type === 'running') return 'Running';
  if (type === 'cardio') return 'Biking';
  return 'Other';
}

/**
 * Generate a simple ISO timestamp offset by seconds from a base time.
 */
function offsetTime(baseIso: string, offsetSec: number): string {
  const d = new Date(baseIso);
  d.setSeconds(d.getSeconds() + offsetSec);
  return d.toISOString();
}

/**
 * Compute total duration in seconds for an exercise.
 * Falls back to reps * 3 seconds as a rough estimate for rep-based exercises.
 */
function exerciseDurationSec(exercise: Exercise): number {
  if (exercise.duration_sec && exercise.duration_sec > 0) {
    return exercise.duration_sec;
  }
  if (exercise.reps && exercise.reps > 0) {
    const sets = exercise.sets ?? 1;
    // Rough estimate: 3 seconds per rep
    return sets * exercise.reps * 3;
  }
  // Default: 60 seconds for exercises with no clear duration
  return 60;
}

/**
 * Generate trackpoint XML for an exercise within a lap.
 */
function generateTrackpoints(startTime: string, durationSec: number): string {
  // Generate a start and end trackpoint for each exercise segment
  const endTime = offsetTime(startTime, durationSec);
  return `
          <Track>
            <Trackpoint>
              <Time>${startTime}</Time>
            </Trackpoint>
            <Trackpoint>
              <Time>${endTime}</Time>
            </Trackpoint>
          </Track>`;
}

/**
 * Generate a TCX Lap element for a block of exercises.
 */
function blockToLap(block: Block, startTime: string): { xml: string; durationSec: number } {
  const exercises = [...block.exercises];
  if (block.supersets) {
    for (const superset of block.supersets) {
      exercises.push(...superset.exercises);
    }
  }

  const rounds = block.rounds ?? 1;
  let totalDuration = 0;
  let trackXml = '';

  for (let round = 0; round < rounds; round++) {
    for (const exercise of exercises) {
      const exDuration = exerciseDurationSec(exercise);
      const exStart = offsetTime(startTime, totalDuration);
      trackXml += generateTrackpoints(exStart, exDuration);
      totalDuration += exDuration;

      // Add rest duration
      if (exercise.rest_sec && exercise.rest_sec > 0) {
        totalDuration += exercise.rest_sec;
      }
    }

    // Rest between rounds
    if (round < rounds - 1 && block.rest_between_rounds_sec) {
      totalDuration += block.rest_between_rounds_sec;
    }
  }

  const xml = `
        <Lap StartTime="${startTime}">
          <TotalTimeSeconds>${totalDuration}</TotalTimeSeconds>
          <DistanceMeters>0</DistanceMeters>
          <Calories>0</Calories>
          <Intensity>Active</Intensity>
          <TriggerMethod>Manual</TriggerMethod>
          <Notes>${escapeXml(block.label)}</Notes>${trackXml}
        </Lap>`;

  return { xml, durationSec: totalDuration };
}

/**
 * Generate a TCX XML string from a WorkoutStructure.
 *
 * @param workout - The workout structure to export
 * @param startTime - Optional ISO timestamp for the activity start (defaults to now)
 * @returns TCX XML string
 */
export function generateTcxXml(workout: WorkoutStructure, startTime?: string): string {
  const activityStart = startTime ?? new Date().toISOString();
  const sport = workoutToTcxSport(workout);

  let lapsXml = '';
  let elapsed = 0;

  for (const block of workout.blocks) {
    const lapStart = offsetTime(activityStart, elapsed);
    const { xml, durationSec } = blockToLap(block, lapStart);
    lapsXml += xml;
    elapsed += durationSec;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="${sport}">
      <Id>${activityStart}</Id>
      <Notes>${escapeXml(workout.title)}</Notes>${lapsXml}
      <Creator xsi:type="Device_t">
        <Name>AmakaFlow</Name>
      </Creator>
    </Activity>
  </Activities>
  <Author xsi:type="Application_t">
    <Name>AmakaFlow</Name>
    <Build>
      <Version>
        <VersionMajor>1</VersionMajor>
        <VersionMinor>0</VersionMinor>
      </Version>
    </Build>
    <LangID>en</LangID>
  </Author>
</TrainingCenterDatabase>`;
}

/**
 * Download a workout as a TCX file.
 *
 * @param workout - The workout structure to export
 * @param filename - Optional filename (without extension)
 * @param startTime - Optional ISO timestamp for the activity start
 */
export function downloadWorkoutTcx(
  workout: WorkoutStructure,
  filename?: string,
  startTime?: string,
): void {
  const tcxXml = generateTcxXml(workout, startTime);
  const blob = new Blob([tcxXml], { type: 'application/vnd.garmin.tcx+xml' });
  const name = filename ?? workout.title.replace(/\s+/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.tcx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
