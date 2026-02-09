/**
 * Parse Instagram/fitness description text to extract exercise names
 * 
 * This module handles multiple formats:
 * - Numbered format: "1. Exercise Name" or "1) Exercise Name"
 * - Bullet format: "• Exercise Name" or "- Exercise Name"
 * - Fitness notation: "Exercise Name 4x8" or "Exercise Name 4 x 8"
 * - Superset notation: "Pull-ups 4x8 + Z Press 4x8"
 * 
 * Fixes applied:
 * - Only splits on '+' when BOTH sides have set/rep notation (prevents splitting compound names)
 * - Specific fitness notation check instead of catch-all fallback
 * - Filters out hashtags, CTAs, and section headers
 */

export interface ParsedExerciseSuggestion {
  id: string;
  label: string;
  duration_sec?: number;
  target_reps?: number;
  notes?: string;
  accepted: boolean;
}

// Patterns to match exercise lines
const NUMBERED_PATTERN = /^\s*(\d+)\s*[.):]\s*(.+)/;
const BULLET_PATTERN = /^\s*[•\-→>]\s*(.+)/;
const EMOJI_NUMBER_PATTERN = /^\s*[\u{1F1E0}-\u{1F9FF}]?\s*(\d+)\s*[.):]\s*(.+)/u;

// Pattern to match lines with fitness set/rep notation (used for validation)
const FITNESS_NOTATION_PATTERN = /^(.+?)\s+\d+\s*[x×]\s*\d+/i;

// Pattern to match set/rep notation for removal from names
const SETS_REPS_PATTERN = /\s*\d+\s*[x×]\s*\d+\s*m?\s*$/i;

// Pattern to detect set/rep notation in text (for superset splitting logic)
const HAS_SETS_REPS_PATTERN = /\d+\s*[x×]\s*\d+/;

// Patterns to skip (hashtags, CTAs, section headers)
const SKIP_PATTERNS = [
  /^#\w+/,  // Hashtags
  /^follow\s+me/i,  // CTAs
  /^subscribe/i,
  /^check\s+out/i,
  /^upper\s+body:/i,  // Section headers
  /^lower\s+body:/i,
  /^warmup:/i,
  /^cooldown:/i,
  /^round\s+\d+:/i,
  /^day\s+\d+:/i,
  /^week\s+\d+:/i,
];

/**
 * Check if text contains set/rep notation (e.g., "4x8", "5 x 10m")
 */
function hasSetsRepsNotation(text: string): boolean {
  return HAS_SETS_REPS_PATTERN.test(text);
}

/**
 * Check if a line should be skipped (hashtag, CTA, header, etc.)
 */
function shouldSkipLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  
  // Check against skip patterns
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  
  // Skip standalone "Workout:" lines
  if (/^workout[:\s]*$/i.test(trimmed)) return true;
  
  return false;
}

/**
 * Clean up exercise name by removing annotations and normalizing
 */
function cleanExerciseName(name: string): string {
  return name
    // Remove trailing arrows and annotations
    .replace(/→.*$/, '')
    // Remove trailing parentheses
    .replace(/\s*\([^)]*\)\s*$/, '')
    // Remove difficulty hints
    .replace(/\s*-\s*(Easy|Hard|Moderate|Dynamic|Static|Supported|Loaded)\s*$/i, '')
    // Remove set/rep notation
    .replace(SETS_REPS_PATTERN, '')
    // Normalize multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if text looks like a valid exercise name (not a CTA or random text)
 */
function looksLikeExerciseName(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  
  // Should start with a letter (exercise names do)
  if (!/^[A-Za-z]/.test(trimmed)) return false;
  
  // Should contain at least one word character
  if (!/\w/.test(trimmed)) return false;
  
  // Check for exercise-like keywords (optional but helpful)
  const exerciseKeywords = [
    'press', 'pull', 'push', 'row', 'squat', 'lunge', 'curl', 'raise', 'fly', 'extension',
    'up', 'down', 'hold', 'negative', 'positive', 'pose', 'stretch', 'rotation'
  ];
  
  const lowerText = trimmed.toLowerCase();
  
  // If it has exercise keywords, it's likely an exercise
  if (exerciseKeywords.some(kw => lowerText.includes(kw))) {
    return true;
  }
  
  // If it's short (3-30 chars) and looks like a name, accept it
  if (trimmed.length <= 50 && /^[A-Za-z][A-Za-z\s\-+'"]+$/.test(trimmed)) {
    return true;
  }
  
  return false;
}

/**
 * Extract exercise name from a line using various patterns
 */
function extractExerciseName(line: string): { name: string | null; remainingText: string | null } {
  const trimmed = line.trim();
  
  // Try numbered pattern first (e.g., "1. Exercise Name")
  const numberedMatch = trimmed.match(NUMBERED_PATTERN);
  if (numberedMatch) {
    return { name: numberedMatch[2].trim(), remainingText: numberedMatch[2].trim() };
  }
  
  // Try bullet pattern (e.g., "• Exercise Name")
  const bulletMatch = trimmed.match(BULLET_PATTERN);
  if (bulletMatch) {
    return { name: bulletMatch[1].trim(), remainingText: bulletMatch[1].trim() };
  }
  
  // Try emoji number pattern
  const emojiMatch = trimmed.match(EMOJI_NUMBER_PATTERN);
  if (emojiMatch) {
    return { name: emojiMatch[2].trim(), remainingText: emojiMatch[2].trim() };
  }
  
  // Handle "Workout:" prefix by extracting content after colon
  if (trimmed.toLowerCase().startsWith('workout:')) {
    const afterColon = trimmed.substring(8).trim();
    if (afterColon) {
      return { name: null, remainingText: afterColon };
    }
    return { name: null, remainingText: null };
  }
  
  // Use the line as-is if it contains fitness notation
  if (FITNESS_NOTATION_PATTERN.test(trimmed)) {
    return { name: null, remainingText: trimmed };
  }
  
  // Accept plain text that looks like an exercise name (no set/rep notation)
  // This handles compound names like "Chin-up + Negative Hold"
  if (looksLikeExerciseName(trimmed)) {
    return { name: null, remainingText: trimmed };
  }
  
  // Skip lines without recognized patterns or valid exercise names
  return { name: null, remainingText: null };
}

/**
 * Split superset text on '+' delimiter only if BOTH sides have set/rep notation
 * 
 * Example: "Pull-ups 4x8 + Z Press 4x8" → ["Pull-ups 4x8", "Z Press 4x8"]
 * Example: "Chin-up + Negative Hold" → ["Chin-up + Negative Hold"] (stays as one)
 */
function splitSuperset(text: string): string[] {
  const parts = text.split(/\s*\+\s*/);
  
  // If there's no '+' or only one part, return as-is
  if (parts.length <= 1) {
    return [text];
  }
  
  // Only split if ALL parts have set/rep notation
  // This prevents splitting compound names like "Chin-up + Negative Hold"
  const allPartsHaveSetsReps = parts.every(part => hasSetsRepsNotation(part));
  
  if (allPartsHaveSetsReps) {
    return parts.map(p => p.trim());
  }
  
  // Keep as single exercise if not all parts have sets/reps
  return [text];
}

/**
 * Parse description text to extract exercise suggestions
 */
export function parseDescriptionForExercises(text: string): ParsedExerciseSuggestion[] {
  if (!text.trim()) return [];

  const exercises: ParsedExerciseSuggestion[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and filtered content
    if (shouldSkipLine(trimmed)) continue;

    // Extract exercise name or remaining text
    const { remainingText } = extractExerciseName(trimmed);

    // Process the extracted text
    if (remainingText) {
      // Split into superset parts (only if all parts have set/rep notation)
      const supersetParts = splitSuperset(remainingText);
      
      for (const part of supersetParts) {
        let cleanedName = cleanExerciseName(part);
        
        // Skip very short names
        if (cleanedName.length <= 2) continue;

        // Skip if it looks like a hashtag or CTA
        if (cleanedName.startsWith('#')) continue;

        exercises.push({
          id: `parsed_${Date.now()}_${exercises.length}`,
          label: cleanedName,
          duration_sec: 30,
          accepted: true, // Default to accepted since user explicitly pasted this
        });
      }
    }
  }

  return exercises;
}
