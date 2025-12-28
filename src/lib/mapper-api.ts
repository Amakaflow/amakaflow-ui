import {
  WorkoutStructure,
  ValidationResponse,
  ExportFormats,
  ExerciseSuggestResponse,
  WorkflowProcessResponse
} from '../types/workout';
import { DeviceId } from './devices';
import { applyValidationMappings } from './workout-utils';
import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';

// Use centralized API config
const MAPPER_API_BASE_URL = API_URLS.MAPPER;

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
  
  // Extract signal from options to ensure it's passed correctly
  const { signal, ...restOptions } = options;
  
  const response = await authenticatedFetch(url, {
    ...restOptions,
    headers,
    signal, // Explicitly pass signal for timeout support
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for validation
  
  try {
    const result = await mapperApiCall<ValidationResponse>('/workflow/validate', {
      method: 'POST',
      body: JSON.stringify({ blocks_json: workout }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Validation request timed out. Please try again.');
    }
    throw error;
  }
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
 * If validation is provided, applies user-confirmed mappings before export
 */
export async function autoMapWorkoutToGarmin(
  workout: WorkoutStructure,
  validation?: ValidationResponse | null
): Promise<{ yaml: string }> {
  // Apply validation mappings to use user-confirmed Garmin names
  const mappedWorkout = applyValidationMappings(workout, validation);

  return mapperApiCall<{ yaml: string }>('/map/auto-map', {
    method: 'POST',
    body: JSON.stringify({ blocks_json: mappedWorkout }),
  });
}

/**
 * Convert workout to device-specific format
 * Handles Garmin, Apple Watch, and Zwift exports
 * If validation is provided, applies user-confirmed mappings before export
 */
export async function exportWorkoutToDevice(
  workout: WorkoutStructure,
  device: DeviceId,
  validation?: ValidationResponse | null
): Promise<ExportFormats> {
  // Apply validation mappings to use user-confirmed Garmin names
  const mappedWorkout = applyValidationMappings(workout, validation);

  switch (device) {
    case 'garmin':
    case 'garmin_usb': {
      const result = await autoMapWorkoutToGarmin(mappedWorkout, null); // Already applied mappings
      return { yaml: result.yaml };
    }

    case 'apple': {
      // Call /map/to-workoutkit for Apple Watch
      const result = await mapperApiCall<any>('/map/to-workoutkit', {
        method: 'POST',
        body: JSON.stringify({ blocks_json: mappedWorkout }),
      });

      // Convert WorkoutKit DTO to plist format (or return as JSON)
      // For now, return as plist string if available, otherwise JSON
      const plist = result.plist || JSON.stringify(result, null, 2);
      return { plist, yaml: '' };
    }

    case 'zwift': {
      // Call /map/to-zwo for Zwift
      // Auto-detect sport from workout content
      const response = await authenticatedFetch(`${MAPPER_API_BASE_URL}/map/to-zwo?sport=run&format=zwo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blocks_json: mappedWorkout }),
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
    // Use a simple GET endpoint with timeout instead of /docs
    // Try /mappings endpoint as a lightweight health check
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await authenticatedFetch(`${MAPPER_API_BASE_URL}/mappings`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok || response.status === 401 || response.status === 403; // 401/403 means API is up but auth required
  } catch (error) {
    // If it's an abort error, the request timed out
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Mapper API health check timed out');
      return false;
    }
    console.warn('Mapper API health check failed:', error);
    return false;
  }
}

