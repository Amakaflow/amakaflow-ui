/**
 * AMA-116: Client-side FIT file generation for Garmin devices.
 *
 * Generates Garmin FIT binary files from WorkoutStructure data.
 * The FIT (Flexible and Interoperable Data Transfer) protocol uses
 * a binary format with specific message types for workout definitions.
 *
 * Reference: https://developer.garmin.com/fit/protocol/
 */

import type { WorkoutStructure, Block, Exercise, WorkoutStructureType } from '../types/workout';

// FIT Protocol constants
const FIT_HEADER_SIZE = 14;
const FIT_PROTOCOL_VERSION = 0x20; // 2.0
const FIT_PROFILE_VERSION = 0x0810; // 2064
const FIT_DATA_TYPE = '.FIT';

// FIT message types
const MESG_NUM_FILE_ID = 0;
const MESG_NUM_WORKOUT = 26;
const MESG_NUM_WORKOUT_STEP = 27;

// FIT field types
const FIT_TYPE_UINT8 = 0;
const FIT_TYPE_UINT16 = 132;
const FIT_TYPE_UINT32 = 134;
const FIT_TYPE_STRING = 7;
const FIT_TYPE_ENUM = 0;

// Workout step types matching Garmin FIT SDK
type FitStepDuration = 'time' | 'reps' | 'open' | 'distance';
type FitStepTarget = 'open' | 'heart_rate' | 'power' | 'speed';
type FitStepIntensity = 'active' | 'rest' | 'warmup' | 'cooldown';

interface FitWorkoutStep {
  stepName: string;
  durationType: FitStepDuration;
  durationValue: number | null;
  targetType: FitStepTarget;
  targetValue: number;
  intensity: FitStepIntensity;
  notes?: string;
}

/**
 * CRC-16 calculation for FIT file integrity
 */
function fitCrc16(data: Uint8Array): number {
  const crcTable = [
    0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
    0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400,
  ];

  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    // Lower nibble
    let tmp = crcTable[crc & 0xF];
    crc = (crc >> 4) & 0x0FFF;
    crc = crc ^ tmp ^ crcTable[byte & 0xF];
    // Upper nibble
    tmp = crcTable[crc & 0xF];
    crc = (crc >> 4) & 0x0FFF;
    crc = crc ^ tmp ^ crcTable[(byte >> 4) & 0xF];
  }
  return crc;
}

/**
 * Simple binary buffer builder for FIT files
 */
class FitBuffer {
  private buffer: number[] = [];

  writeUint8(value: number): void {
    this.buffer.push(value & 0xFF);
  }

  writeUint16(value: number): void {
    this.buffer.push(value & 0xFF);
    this.buffer.push((value >> 8) & 0xFF);
  }

  writeUint32(value: number): void {
    this.buffer.push(value & 0xFF);
    this.buffer.push((value >> 8) & 0xFF);
    this.buffer.push((value >> 16) & 0xFF);
    this.buffer.push((value >> 24) & 0xFF);
  }

  writeString(value: string, maxLength: number): void {
    const bytes = new TextEncoder().encode(value.substring(0, maxLength - 1));
    for (let i = 0; i < maxLength; i++) {
      this.buffer.push(i < bytes.length ? bytes[i] : 0);
    }
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  get length(): number {
    return this.buffer.length;
  }
}

/**
 * Encode workout structure type to FIT step intensity
 */
function structureToIntensity(structure: WorkoutStructureType | null): FitStepIntensity {
  switch (structure) {
    case 'warmup': return 'warmup';
    case 'cooldown': return 'cooldown';
    default: return 'active';
  }
}

/**
 * Convert exercise to FIT workout step
 */
function exerciseToFitStep(exercise: Exercise, blockStructure: WorkoutStructureType | null): FitWorkoutStep {
  let durationType: FitStepDuration = 'open';
  let durationValue: number | null = null;

  if (exercise.duration_sec && exercise.duration_sec > 0) {
    durationType = 'time';
    durationValue = exercise.duration_sec * 1000; // FIT uses milliseconds
  } else if (exercise.reps && exercise.reps > 0) {
    durationType = 'reps';
    durationValue = exercise.reps;
  } else if (exercise.distance_m && exercise.distance_m > 0) {
    durationType = 'distance';
    durationValue = exercise.distance_m * 100; // FIT uses centimeters
  }

  return {
    stepName: exercise.name.substring(0, 16), // FIT string limit
    durationType,
    durationValue,
    targetType: 'open',
    targetValue: 0,
    intensity: structureToIntensity(blockStructure),
    notes: exercise.notes ?? undefined,
  };
}

/**
 * Convert rest period to FIT rest step
 */
function restToFitStep(restSec: number): FitWorkoutStep {
  return {
    stepName: 'Rest',
    durationType: 'time',
    durationValue: restSec * 1000,
    targetType: 'open',
    targetValue: 0,
    intensity: 'rest',
  };
}

/**
 * Flatten workout structure into FIT steps
 */
function flattenToFitSteps(workout: WorkoutStructure): FitWorkoutStep[] {
  const steps: FitWorkoutStep[] = [];

  for (const block of workout.blocks) {
    const rounds = block.rounds ?? 1;

    for (let round = 0; round < rounds; round++) {
      // Block exercises
      for (const exercise of block.exercises) {
        steps.push(exerciseToFitStep(exercise, block.structure));

        // Add rest between exercises if specified
        if (exercise.rest_sec && exercise.rest_sec > 0) {
          steps.push(restToFitStep(exercise.rest_sec));
        }
      }

      // Superset exercises
      if (block.supersets) {
        for (const superset of block.supersets) {
          for (const exercise of superset.exercises) {
            steps.push(exerciseToFitStep(exercise, block.structure));
          }
          if (superset.rest_between_sec && superset.rest_between_sec > 0) {
            steps.push(restToFitStep(superset.rest_between_sec));
          }
        }
      }

      // Rest between rounds
      if (round < rounds - 1 && block.rest_between_rounds_sec) {
        steps.push(restToFitStep(block.rest_between_rounds_sec));
      }
    }
  }

  return steps;
}

/**
 * Duration type enum values in FIT protocol
 */
function durationTypeToFit(dt: FitStepDuration): number {
  switch (dt) {
    case 'time': return 0;
    case 'distance': return 1;
    case 'reps': return 6;
    case 'open': return 3;
    default: return 3;
  }
}

/**
 * Target type enum values in FIT protocol
 */
function targetTypeToFit(tt: FitStepTarget): number {
  switch (tt) {
    case 'open': return 0;
    case 'heart_rate': return 1;
    case 'power': return 4;
    case 'speed': return 2;
    default: return 0;
  }
}

/**
 * Intensity enum values in FIT protocol
 */
function intensityToFit(intensity: FitStepIntensity): number {
  switch (intensity) {
    case 'active': return 0;
    case 'rest': return 1;
    case 'warmup': return 2;
    case 'cooldown': return 3;
    default: return 0;
  }
}

/**
 * Write a FIT definition message
 */
function writeDefinitionMessage(
  buf: FitBuffer,
  localMesgType: number,
  globalMesgNum: number,
  fields: Array<{ fieldDefNum: number; size: number; type: number }>
): void {
  // Record header: definition message (bit 6 = 1)
  buf.writeUint8(0x40 | (localMesgType & 0x0F));
  buf.writeUint8(0); // reserved
  buf.writeUint8(0); // architecture: little-endian
  buf.writeUint16(globalMesgNum);
  buf.writeUint8(fields.length);

  for (const field of fields) {
    buf.writeUint8(field.fieldDefNum);
    buf.writeUint8(field.size);
    buf.writeUint8(field.type);
  }
}

/**
 * Generate a FIT binary file from a WorkoutStructure.
 *
 * @param workout - The workout structure to convert
 * @returns Uint8Array containing the FIT file binary data
 */
export function generateFitFile(workout: WorkoutStructure): Uint8Array {
  const steps = flattenToFitSteps(workout);
  const workoutName = workout.title.substring(0, 20); // FIT limit

  const dataBuf = new FitBuffer();

  // --- File ID Message (mesg 0) ---
  writeDefinitionMessage(dataBuf, 0, MESG_NUM_FILE_ID, [
    { fieldDefNum: 0, size: 1, type: FIT_TYPE_ENUM },    // type (workout = 5)
    { fieldDefNum: 1, size: 2, type: FIT_TYPE_UINT16 },   // manufacturer
    { fieldDefNum: 2, size: 2, type: FIT_TYPE_UINT16 },   // product
    { fieldDefNum: 3, size: 4, type: FIT_TYPE_UINT32 },   // serial_number
    { fieldDefNum: 4, size: 4, type: FIT_TYPE_UINT32 },   // time_created
  ]);

  // Data record for File ID
  dataBuf.writeUint8(0x00); // record header: local message type 0
  dataBuf.writeUint8(5);    // type = workout
  dataBuf.writeUint16(1);   // manufacturer = Garmin
  dataBuf.writeUint16(1);   // product
  dataBuf.writeUint32(12345); // serial
  dataBuf.writeUint32(Math.floor(Date.now() / 1000) - 631065600); // Garmin epoch offset

  // --- Workout Message (mesg 26) ---
  const nameBytes = 24; // Fixed name field length
  writeDefinitionMessage(dataBuf, 1, MESG_NUM_WORKOUT, [
    { fieldDefNum: 4, size: 1, type: FIT_TYPE_ENUM },     // sport
    { fieldDefNum: 6, size: nameBytes, type: FIT_TYPE_STRING }, // wkt_name
    { fieldDefNum: 7, size: 2, type: FIT_TYPE_UINT16 },   // num_valid_steps
  ]);

  // Data record for Workout
  dataBuf.writeUint8(0x01); // local message type 1
  dataBuf.writeUint8(4);    // sport = generic (4) - safest default
  dataBuf.writeString(workoutName, nameBytes);
  dataBuf.writeUint16(steps.length);

  // --- Workout Step Messages (mesg 27) ---
  const stepNameBytes = 20;
  writeDefinitionMessage(dataBuf, 2, MESG_NUM_WORKOUT_STEP, [
    { fieldDefNum: 0, size: stepNameBytes, type: FIT_TYPE_STRING }, // wkt_step_name
    { fieldDefNum: 1, size: 1, type: FIT_TYPE_ENUM },   // duration_type
    { fieldDefNum: 2, size: 4, type: FIT_TYPE_UINT32 },  // duration_value
    { fieldDefNum: 3, size: 1, type: FIT_TYPE_ENUM },   // target_type
    { fieldDefNum: 4, size: 4, type: FIT_TYPE_UINT32 },  // target_value
    { fieldDefNum: 6, size: 1, type: FIT_TYPE_ENUM },   // intensity
    { fieldDefNum: 254, size: 2, type: FIT_TYPE_UINT16 }, // message_index
  ]);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    dataBuf.writeUint8(0x02); // local message type 2
    dataBuf.writeString(step.stepName, stepNameBytes);
    dataBuf.writeUint8(durationTypeToFit(step.durationType));
    dataBuf.writeUint32(step.durationValue ?? 0);
    dataBuf.writeUint8(targetTypeToFit(step.targetType));
    dataBuf.writeUint32(step.targetValue);
    dataBuf.writeUint8(intensityToFit(step.intensity));
    dataBuf.writeUint16(i); // message_index
  }

  const dataBytes = dataBuf.getBytes();

  // Build final file: header + data + CRC
  const fileSize = FIT_HEADER_SIZE + dataBytes.length + 2; // 2 for CRC
  const headerBuf = new FitBuffer();
  headerBuf.writeUint8(FIT_HEADER_SIZE);     // header size
  headerBuf.writeUint8(FIT_PROTOCOL_VERSION); // protocol version
  headerBuf.writeUint16(FIT_PROFILE_VERSION); // profile version
  headerBuf.writeUint32(dataBytes.length);    // data size (excluding header and CRC)
  // Data type: '.FIT'
  headerBuf.writeUint8(46);  // '.'
  headerBuf.writeUint8(70);  // 'F'
  headerBuf.writeUint8(73);  // 'I'
  headerBuf.writeUint8(84);  // 'T'
  // Header CRC
  const headerBytes = headerBuf.getBytes();
  const headerCrc = fitCrc16(headerBytes.slice(0, 12));
  headerBuf.writeUint16(headerCrc);

  // Combine header + data
  const fullHeaderBytes = headerBuf.getBytes();
  const combined = new Uint8Array(fullHeaderBytes.length + dataBytes.length);
  combined.set(fullHeaderBytes, 0);
  combined.set(dataBytes, fullHeaderBytes.length);

  // Calculate file CRC (over header + data)
  const fileCrc = fitCrc16(combined);

  // Final output
  const output = new Uint8Array(combined.length + 2);
  output.set(combined, 0);
  output[combined.length] = fileCrc & 0xFF;
  output[combined.length + 1] = (fileCrc >> 8) & 0xFF;

  return output;
}

/**
 * Generate and download a FIT file for a workout.
 *
 * @param workout - The workout structure to export
 * @param filename - Optional filename (without extension)
 */
export function downloadFitFile(workout: WorkoutStructure, filename?: string): void {
  const fitBytes = generateFitFile(workout);
  const blob = new Blob([fitBytes], { type: 'application/octet-stream' });
  const name = filename ?? workout.title.replace(/\s+/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.fit`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
