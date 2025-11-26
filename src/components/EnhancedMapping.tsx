import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Sparkles, 
  CheckCircle2, 
  Search, 
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { ValidationResult, ExerciseSuggestion } from '../types/workout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';

interface EnhancedMappingProps {
  result: ValidationResult;
  onApplyMapping: (exerciseName: string, newMapping: string) => void;
  onAcceptMapping: (exerciseName: string) => void;
  isRecentlyUpdated?: boolean;
  isConfirmed?: boolean;
}

export function EnhancedMapping({ result, onApplyMapping, onAcceptMapping, isRecentlyUpdated = false, isConfirmed = false }: EnhancedMappingProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string>('');
  const [customMapping, setCustomMapping] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ExerciseSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | null>(null);

  const handleApplySuggestion = () => {
    if (selectedSuggestion) {
      onApplyMapping(result.original_name, selectedSuggestion);
      setIsDialogOpen(false);
      setSelectedSuggestion('');
      // Note: Toast notification is handled in ValidateMap's handleApplyMapping
    }
  };

  const handleApplyCustom = () => {
    if (customMapping.trim()) {
      onApplyMapping(result.original_name, customMapping.trim());
      setIsDialogOpen(false);
      setCustomMapping('');
      // Note: Toast notification is handled in ValidateMap's handleApplyMapping
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      // Call real mapper API for exercise suggestions
      const { getExerciseSuggestions } = await import('../lib/mapper-api');
      const suggestions = await getExerciseSuggestions(searchQuery.trim(), true);
      
      // Combine similar exercises and exercises by type
      const allSearchResults: ExerciseSuggestion[] = [
        ...(suggestions.similar_exercises || []),
        ...(suggestions.exercises_by_type || [])
      ];
      
      // Remove duplicates by name
      const uniqueResults = allSearchResults.filter((item, index, self) =>
        index === self.findIndex((t) => t.name === item.name)
      );
      
      // Sort by score descending
      uniqueResults.sort((a, b) => b.score - a.score);
      
      setSearchResults(uniqueResults);
      
      const count = uniqueResults.length;
      if (count > 0) {
        toast.success(`Found ${count} similar exercises`);
      } else {
        toast.info('No similar exercises found');
        setSearchResults([]);
      }
    } catch (error: any) {
      toast.error(`Failed to search exercises: ${error.message || 'Unknown error'}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-orange-600';
    return 'text-red-600';
  };

  // Extract suggestions from new format (array of {name, confidence}) or legacy format
  const getSuggestions = () => {
    // New format: result.suggestions is an array of {name, confidence}
    if (Array.isArray(result.suggestions) && result.suggestions.length > 0) {
      // Check if it's the new format (has 'confidence' property)
      if (result.suggestions[0] && 'confidence' in result.suggestions[0]) {
        return result.suggestions.map(s => ({
          name: s.name,
          score: s.confidence, // Map confidence to score for compatibility
        }));
      }
    }
    // Legacy format: result.suggestions has similar and by_type arrays
    if (result.suggestions && typeof result.suggestions === 'object' && 'similar' in result.suggestions) {
      return [
        ...((result.suggestions as any).similar || []),
        ...((result.suggestions as any).by_type || [])
      ];
    }
    return [];
  };

  const originalSuggestions = getSuggestions();
  
  // If we have search results, use them, otherwise use original suggestions
  const allSuggestions = searchResults.length > 0 ? searchResults : originalSuggestions;
  
  const topSuggestions = originalSuggestions.slice(0, 5); // Show up to 5 suggestions

  return (
    <Card className={`transition-all duration-300 ${
      isRecentlyUpdated 
        ? 'ring-2 ring-green-500 ring-offset-2 bg-green-50/50 dark:bg-green-950/20 animate-pulse-once' 
        : ''
    }`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Show only the mapped name if it exists and is different, otherwise show original */}
              <CardTitle className="text-base">
                {result.mapped_to && result.mapped_to !== result.original_name 
                  ? result.mapped_to 
                  : result.original_name}
              </CardTitle>
              {isRecentlyUpdated && (
                <Badge variant="default" className="bg-green-500 text-white animate-fade-in">
                  ✓ Updated
                </Badge>
              )}
              {isConfirmed && (
                <Badge variant="default" className="bg-blue-500 text-white">
                  ✓ Confirmed
                </Badge>
              )}
              {result.mapped_to && result.mapped_to !== result.original_name && !isConfirmed && (
                <Badge variant="outline" className="border-green-500 text-green-600">
                  Mapped
                </Badge>
              )}
            </div>
            {/* Show original name - always show for context */}
            <CardDescription className="mt-1 text-xs text-muted-foreground">
              Original: {result.original_name}
            </CardDescription>
          </div>
          <Badge 
            variant={result.confidence >= 0.9 ? 'default' : result.confidence >= 0.7 ? 'secondary' : 'destructive'}
            className={getConfidenceColor(result.confidence)}
          >
            {(result.confidence * 100).toFixed(0)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Action Required Alert for Unmapped */}
        {!result.mapped_to && (
          <div className="rounded-lg border border-orange-500/50 bg-orange-50 dark:bg-orange-950/20 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  Action Required
                </div>
                <div className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  {topSuggestions.length > 0 
                    ? "Select one of the AI suggestions below, or click 'Find & Select Mapping' to see more options."
                    : "Click 'Find & Select Mapping' to see AI suggestions and search for alternatives."}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Needs Review Alert */}
        {result.status === 'needs_review' && result.mapped_to && !isConfirmed && (
          <div className="rounded-lg border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  Review Required
                </div>
                <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  A mapping has been suggested: <strong>{result.mapped_to}</strong>. Click "Confirm" to accept or "Change Mapping" to select a different exercise.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Suggestions - Show for unmapped or needs_review exercises with suggestions */}
        {topSuggestions.length > 0 && (result.status === 'unmapped' || result.status === 'needs_review') && (
          <div className="space-y-2">
            <Label className="text-xs">Suggestions - Click to Apply</Label>
            <div className="flex flex-wrap gap-2">
              {topSuggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                    selectedSuggestionIndex === idx 
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20' 
                      : 'bg-muted/50 hover:bg-muted hover:border-primary/50'
                  }`}
                  onClick={() => {
                    setSelectedSuggestionIndex(idx);
                    // Apply immediately when clicking the suggestion
                    onApplyMapping(result.original_name, suggestion.name);
                    setSelectedSuggestionIndex(null);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{suggestion.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(suggestion.score * 100).toFixed(0)}%
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSuggestionIndex(idx);
                      onApplyMapping(result.original_name, suggestion.name);
                      setSelectedSuggestionIndex(null);
                    }}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            {originalSuggestions.length > topSuggestions.length && (
              <p className="text-xs text-muted-foreground text-center">
                + {originalSuggestions.length - topSuggestions.length} more suggestions available in "Find & Select Mapping"
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {/* Show Confirm button if exercise has a mapping (even if same as original) OR if status is needs_review */}
          {(result.mapped_to || result.status === 'needs_review') && (
            <Button
              size="sm"
              variant={isConfirmed ? "default" : "outline"}
              className={`flex-1 ${isConfirmed ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
              onClick={() => {
                onAcceptMapping(result.original_name);
              }}
              disabled={isConfirmed}
            >
              {isConfirmed ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-2" />
                  Confirmed
                </>
              ) : (
                <>
                  <ThumbsUp className="w-3 h-3 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          )}
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            // Reset search when dialog closes
            if (!open) {
              setSearchQuery('');
              setSearchResults([]);
              setSelectedSuggestion('');
              setCustomMapping('');
              setSelectedSuggestionIndex(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant={!result.mapped_to ? "default" : "outline"}
                className={`flex-1 ${!result.mapped_to ? 'bg-primary hover:bg-primary/90' : ''}`}
              >
                <Sparkles className="w-3 h-3 mr-2" />
                {!result.mapped_to ? 'Find & Select Mapping' : 'Change Mapping'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Map Exercise: {result.original_name}</DialogTitle>
                <DialogDescription>
                  Select an AI suggestion, search for alternatives, or create a custom mapping
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label>Search Similar Exercises</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search exercise database..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={isSearching}>
                      {isSearching ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <Label>Search Results ({searchResults.length})</Label>
                    <Select value={selectedSuggestion} onValueChange={setSelectedSuggestion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a suggested mapping..." />
                      </SelectTrigger>
                      <SelectContent>
                        {searchResults.map((suggestion, idx) => (
                          <SelectItem 
                            key={idx} 
                            value={suggestion.name}
                            onSelect={() => setSelectedSuggestionIndex(-1 - idx)} // Negative to differentiate from top suggestions
                          >
                            <div className="flex items-center gap-3">
                              <span>{suggestion.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {(suggestion.score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => {
                        handleApplySuggestion();
                        setSelectedSuggestionIndex(null);
                      }}
                      disabled={!selectedSuggestion}
                      className="w-full"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Apply Selected Suggestion
                    </Button>
                  </div>
                )}

                {/* Original AI Suggestions (show if no search results) */}
                {searchResults.length === 0 && originalSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <Label>AI Suggestions ({originalSuggestions.length})</Label>
                    <Select value={selectedSuggestion} onValueChange={setSelectedSuggestion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a suggested mapping..." />
                      </SelectTrigger>
                      <SelectContent>
                        {originalSuggestions.map((suggestion, idx) => (
                          <SelectItem 
                            key={idx} 
                            value={suggestion.name}
                            onSelect={() => setSelectedSuggestionIndex(-1 - idx)}
                          >
                            <div className="flex items-center gap-3">
                              <span>{suggestion.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {(suggestion.score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => {
                        handleApplySuggestion();
                        setSelectedSuggestionIndex(null);
                      }}
                      disabled={!selectedSuggestion}
                      className="w-full"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Apply Selected Suggestion
                    </Button>
                  </div>
                )}

                {/* Custom Mapping */}
                <div className="space-y-2">
                  <Label>Custom Mapping</Label>
                  <Input
                    placeholder="Enter custom exercise name..."
                    value={customMapping}
                    onChange={(e) => setCustomMapping(e.target.value)}
                  />
                  <Button
                    onClick={handleApplyCustom}
                    disabled={!customMapping.trim()}
                    variant="outline"
                    className="w-full"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Use Custom Mapping
                  </Button>
                </div>

                {/* Reject Option */}
                {result.status !== 'unmapped' && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        toast.info('Exercise marked for manual review');
                        setIsDialogOpen(false);
                      }}
                    >
                      <ThumbsDown className="w-4 h-4 mr-2" />
                      Reject Mapping
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}