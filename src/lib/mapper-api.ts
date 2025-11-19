import { 
  WorkoutStructure, 
  ValidationResponse, 
  ExportFormats, 
  ExerciseSuggestResponse,
  WorkflowProcessResponse 
} from '../types/workout';
import { DeviceId } from './devices';

// API base URL - defaults to localhost:8001 (mapper-api)
const MAPPER_API_BASE_URL = import.meta.env.VITE_MAPPER_API_URL || 'http://localhost:8001';

/**
 * Generic API call function for mapper-api
 */
async function mapperApiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${MAPPER_API_BASE_URL}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Mapper API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Validate workout mapping
 * Calls /workflow/validate endpoint
 */
export async function validateWorkoutMapping(
  workout: WorkoutStructure
): Promise<ValidationResponse> {
  return mapperApiCall<ValidationResponse>('/workflow/validate', {
    method: 'POST',
    body: JSON.stringify({ blocks_json: workout }),
  });
}

/**
 * Process workout with validation
 * Calls /workflow/process endpoint
 */
export async function processWorkoutWithValidation(
  workout: WorkoutStructure,
  autoProceed: boolean = false
): Promise<WorkflowProcessResponse> {
  return mapperApiCall<WorkflowProcessResponse>('/workflow/process', {
    method: 'POST',
    body: JSON.stringify({ 
      blocks_json: workout,
      auto_proceed: autoProceed
    }),
  });
}

/**
 * Auto-map workout to Garmin YAML
 * Calls /map/auto-map endpoint
 */
export async function autoMapWorkoutToGarmin(
  workout: WorkoutStructure
): Promise<{ yaml: string }> {
  return mapperApiCall<{ yaml: string }>('/map/auto-map', {
    method: 'POST',
    body: JSON.stringify({ blocks_json: workout }),
  });
}

/**
 * Convert workout to device-specific format
 * Handles Garmin, Apple Watch, and Zwift exports
 */
export async function exportWorkoutToDevice(
  workout: WorkoutStructure,
  device: DeviceId
): Promise<ExportFormats> {
  switch (device) {
    case 'garmin': {
      const result = await autoMapWorkoutToGarmin(workout);
      return { yaml: result.yaml };
    }
    
    case 'apple': {
      // Call /map/to-workoutkit for Apple Watch
      const result = await mapperApiCall<any>('/map/to-workoutkit', {
        method: 'POST',
        body: JSON.stringify({ blocks_json: workout }),
      });
      
      // Convert WorkoutKit DTO to plist format (or return as JSON)
      // For now, return as plist string if available, otherwise JSON
      const plist = result.plist || JSON.stringify(result, null, 2);
      return { plist, yaml: '' };
    }
    
    case 'zwift': {
      // Call /map/to-zwo for Zwift
      // Auto-detect sport from workout content
      const response = await fetch(`${MAPPER_API_BASE_URL}/map/to-zwo?sport=run&format=zwo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blocks_json: workout }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `Zwift export error: ${response.status}`);
      }
      
      const zwo = await response.text();
      return { zwo, yaml: '' };
    }
    
    default:
      throw new Error(`Unsupported device: ${device}`);
  }
}

/**
 * Get exercise suggestions
 * Calls /exercise/suggest endpoint
 */
export async function getExerciseSuggestions(
  exerciseName: string,
  includeSimilarTypes: boolean = true
): Promise<ExerciseSuggestResponse> {
  return mapperApiCall<ExerciseSuggestResponse>('/exercise/suggest', {
    method: 'POST',
    body: JSON.stringify({
      exercise_name: exerciseName,
      include_similar_types: includeSimilarTypes,
    }),
  });
}

/**
 * Save user mapping
 * Calls /mappings/add endpoint
 */
export async function saveUserMapping(
  exerciseName: string,
  garminName: string
): Promise<{ message: string; mapping: any }> {
  return mapperApiCall('/mappings/add', {
    method: 'POST',
    body: JSON.stringify({
      exercise_name: exerciseName,
      garmin_name: garminName,
    }),
  });
}

/**
 * Check if mapper-api is available
 */
export async function checkMapperApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${MAPPER_API_BASE_URL}/docs`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

