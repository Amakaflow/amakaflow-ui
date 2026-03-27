/**
 * MapStep Component
 *
 * Step 2 of bulk import: Column mapping for file imports.
 * Maps source columns to workout fields (exercise name, sets, reps, etc.)
 * Shows auto-detected mappings with confidence indicators.
 */

import { useState, useCallback, useMemo } from 'react';
import { useBulkImportApi } from '../../hooks/useBulkImportApi';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  CheckCircle,
  AlertTriangle,
  Wand2,
  ArrowRight,
  Loader2,
  Info,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { ColumnMapping, MappingTargetField, DetectedPattern } from '../../types/bulk-import';

interface MapStepProps {
  userId: string;
  columns: ColumnMapping[];
  patterns: DetectedPattern[];
  loading: boolean;
  onApply: (columns: ColumnMapping[]) => void;
}

// Field options for dropdown
const fieldOptions: { value: MappingTargetField; label: string; description: string }[] = [
  { value: 'exercise', label: 'Exercise Name', description: 'Name of the exercise' },
  { value: 'sets', label: 'Sets', description: 'Number of sets' },
  { value: 'reps', label: 'Reps', description: 'Number of reps' },
  { value: 'weight', label: 'Weight', description: 'Weight used' },
  { value: 'duration', label: 'Duration', description: 'Time-based exercise' },
  { value: 'rest', label: 'Rest', description: 'Rest period' },
  { value: 'notes', label: 'Notes', description: 'Exercise notes' },
  { value: 'title', label: 'Workout Title', description: 'Name of workout' },
  { value: 'block', label: 'Block/Section', description: 'Grouping label' },
  { value: 'day', label: 'Day', description: 'Day number/name' },
  { value: 'week', label: 'Week', description: 'Week number' },
  { value: 'ignore', label: 'Ignore', description: 'Skip this column' },
];

// Pattern type labels
const patternLabels: Record<string, { label: string; icon: typeof AlertTriangle; color: string }> = {
  superset_notation: { label: 'Supersets', icon: RefreshCw, color: 'text-purple-400' },
  complex_movement: { label: 'Complex Movements', icon: Info, color: 'text-blue-400' },
  duration_exercise: { label: 'Duration Exercises', icon: Info, color: 'text-cyan-400' },
  percentage_weight: { label: 'Percentage Weights', icon: Info, color: 'text-amber-400' },
  warmup_sets: { label: 'Warmup Sets', icon: Info, color: 'text-emerald-400' },
};

// Confidence color helper
const getConfidenceColor = (confidence: number) => {
  if (confidence >= 90) return 'text-emerald-400';
  if (confidence >= 70) return 'text-amber-400';
  return 'text-red-400';
};

const getConfidenceBg = (confidence: number) => {
  if (confidence >= 90) return 'bg-emerald-500/10';
  if (confidence >= 70) return 'bg-amber-500/10';
  return 'bg-red-500/10';
};

export function MapStep({ userId, columns, patterns, loading, onApply }: MapStepProps) {
  const { applyColumnMappings } = useBulkImportApi({ userId });

  const [localMappings, setLocalMappings] = useState<ColumnMapping[]>(columns);

  // Calculate if we have minimum required mappings
  const hasRequiredMappings = useMemo(() => {
    return localMappings.some(m => m.targetField === 'exercise');
  }, [localMappings]);

  // Count auto-detected mappings
  const autoDetectedCount = useMemo(() => {
    return localMappings.filter(m => !m.userOverride && m.confidence >= 70).length;
  }, [localMappings]);

  // Handle mapping change
  const handleMappingChange = useCallback((index: number, targetField: MappingTargetField) => {
    setLocalMappings(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        targetField,
        userOverride: true,
      };
      return updated;
    });
  }, []);

  // Reset to auto-detected mappings
  const resetMappings = useCallback(() => {
    setLocalMappings(columns);
  }, [columns]);

  // Apply mappings and proceed
  const handleApplyMappings = useCallback(async () => {
    await applyColumnMappings(localMappings);
    onApply(localMappings);
  }, [localMappings, applyColumnMappings, onApply]);

  // If no columns detected, file was parsed directly - allow skipping
  if (localMappings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-500 mb-4" />
        <h3 className="text-lg font-medium mb-2">File Parsed Successfully</h3>
        <p className="text-muted-foreground max-w-md mb-6">
          Your file format was recognized and parsed directly.
          No manual column mapping is needed.
        </p>
        <Button onClick={() => onApply([])} size="lg" className="h-12">
          Continue to Match Exercises
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Auto-detection Banner */}
      {autoDetectedCount > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <Wand2 className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="font-medium text-emerald-400">
                {autoDetectedCount} column{autoDetectedCount !== 1 ? 's' : ''} auto-detected
              </p>
              <p className="text-sm text-emerald-400/70">
                Review and adjust mappings as needed
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={resetMappings}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      )}

      {/* Column Mapping Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="w-[200px]">Source Column</TableHead>
              <TableHead className="w-[100px] text-center">Samples</TableHead>
              <TableHead className="w-[50px] text-center"></TableHead>
              <TableHead className="w-[200px]">Map To</TableHead>
              <TableHead className="w-[100px] text-center">Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localMappings.map((mapping, index) => (
              <TableRow key={index} className="border-white/10">
                {/* Source Column */}
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {mapping.sourceColumnIndex + 1}.
                    </span>
                    {mapping.sourceColumn}
                  </div>
                </TableCell>

                {/* Sample Values */}
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {mapping.sampleValues.slice(0, 2).map((sample, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-[10px] max-w-[80px] truncate"
                      >
                        {sample}
                      </Badge>
                    ))}
                  </div>
                </TableCell>

                {/* Arrow */}
                <TableCell className="text-center">
                  <ArrowRight className="w-4 h-4 text-muted-foreground mx-auto" />
                </TableCell>

                {/* Target Field Dropdown */}
                <TableCell>
                  <Select
                    value={mapping.targetField}
                    onValueChange={(value) => handleMappingChange(index, value as MappingTargetField)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Confidence */}
                <TableCell className="text-center">
                  {mapping.userOverride ? (
                    <Badge variant="secondary" className="text-xs">
                      Manual
                    </Badge>
                  ) : (
                    <div
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                        getConfidenceBg(mapping.confidence)
                      )}
                    >
                      {mapping.confidence >= 90 && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                      {mapping.confidence >= 70 && mapping.confidence < 90 && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                      <span className={getConfidenceColor(mapping.confidence)}>
                        {mapping.confidence}%
                      </span>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detected Patterns */}
      {patterns.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Detected Patterns</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {patterns.map((pattern, index) => {
              const config = patternLabels[pattern.patternType];
              if (!config) return null;

              return (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <config.icon className={cn('w-4 h-4 mt-0.5', config.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{config.label}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {pattern.count} found
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {pattern.examples.slice(0, 3).map((ex, i) => (
                        <code key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10">
                          {ex}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Validation Warning */}
      {!hasRequiredMappings && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-400">Exercise column required</p>
            <p className="text-sm text-amber-400/70 mt-1">
              Please map at least one column to "Exercise Name" to continue.
            </p>
          </div>
        </div>
      )}

      {/* Apply Button */}
      <Button
        onClick={handleApplyMappings}
        disabled={!hasRequiredMappings || loading}
        className="w-full h-12 text-base"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Applying Mappings...
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5 mr-2" />
            Apply Mappings & Continue
          </>
        )}
      </Button>
    </div>
  );
}

export default MapStep;
