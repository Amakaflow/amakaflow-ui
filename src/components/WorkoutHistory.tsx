import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Clock, Dumbbell, Watch, Bike, Download, Activity, CheckCircle2, ExternalLink, Eye, Trash2, ChevronRight, Edit, List, Search, BarChart3, FileText, Layers, Play, X } from 'lucide-react';
import { WorkoutHistoryItem } from '../lib/workout-history';
import { isAccountConnectedSync } from '../lib/linked-accounts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

type Props = {
  history: WorkoutHistoryItem[];
  onLoadWorkout: (item: WorkoutHistoryItem) => void;
  onEditWorkout?: (item: WorkoutHistoryItem) => void;
  onDeleteWorkout: (id: string) => void;
  onEnhanceStrava?: (item: WorkoutHistoryItem) => void;
};

type ViewCard = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  type: 'summary' | 'detail';
  category: string;
};

export function WorkoutHistory({ history, onLoadWorkout, onEditWorkout, onDeleteWorkout, onEnhanceStrava }: Props) {
  const stravaConnected = isAccountConnectedSync('strava');
  const [viewingWorkout, setViewingWorkout] = useState<WorkoutHistoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'detail'>('summary');
  const [showCardSelector, setShowCardSelector] = useState(false);
  
  // Ensure history is an array
  const safeHistory = Array.isArray(history) ? history : [];
  
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this workout?')) {
      setDeletingId(id);
      try {
        await onDeleteWorkout(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Helper to get mapped exercise name from validation
  const getMappedExerciseName = (originalName: string, validation: any): string => {
    if (!validation) return originalName;
    
    // Check all validation arrays for a mapping
    const allValidated = [
      ...(validation.validated_exercises || []),
      ...(validation.needs_review || []),
      ...(validation.unmapped_exercises || [])
    ];
    
    const match = allValidated.find((v: any) => 
      v.original_name === originalName && v.mapped_to
    );
    
    return match?.mapped_to || originalName;
  };

  // Helper to download export file
  const handleExport = (item: WorkoutHistoryItem) => {
    if (!item.exports) return;
    
    const format = item.device === 'garmin' ? item.exports?.fit 
      : item.device === 'apple' ? item.exports?.plist 
      : item.exports?.zwo;
    
    if (format) {
      const blob = new Blob([format], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(item.workout.title || 'workout').replace(/\s+/g, '_')}.${
        item.device === 'garmin' ? 'fit' : item.device === 'apple' ? 'plist' : 'zwo'
      }`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Generate available view cards for a workout
  const getAvailableCards = (workout: WorkoutHistoryItem | null): ViewCard[] => {
    if (!workout) return [];

    const exerciseCount = (workout.workout?.blocks || []).reduce((sum: number, block: any) => {
      if (block?.supersets && block.supersets.length > 0) {
        return sum + block.supersets.reduce((s: number, ss: any) => s + (ss?.exercises?.length || 0), 0);
      } else if (block?.exercises) {
        return sum + (block.exercises.length || 0);
      }
      return sum;
    }, 0);

    const cards: ViewCard[] = [
      {
        id: 'summary',
        title: 'Workout Summary',
        description: `Overview with ${workout.workout?.blocks?.length || 0} blocks and ${exerciseCount} exercises`,
        icon: <BarChart3 className="w-4 h-4" />,
        type: 'summary',
        category: 'Overview',
      },
      {
        id: 'blocks',
        title: 'Block Breakdown',
        description: 'Detailed view of all workout blocks',
        icon: <Layers className="w-4 h-4" />,
        type: 'detail',
        category: 'Structure',
      },
      {
        id: 'exercises',
        title: 'Exercise List',
        description: 'Complete list of all exercises',
        icon: <Dumbbell className="w-4 h-4" />,
        type: 'detail',
        category: 'Structure',
      },
      {
        id: 'validation',
        title: 'Validation Status',
        description: workout.validation ? 'Mapped exercises and validation details' : 'No validation data',
        icon: <CheckCircle2 className="w-4 h-4" />,
        type: 'summary',
        category: 'Validation',
      },
      {
        id: 'sources',
        title: 'Workout Sources',
        description: `${workout.sources?.length || 0} source(s) used to create this workout`,
        icon: <FileText className="w-4 h-4" />,
        type: 'summary',
        category: 'Metadata',
      },
      {
        id: 'export',
        title: 'Export Options',
        description: workout.exports ? 'Available export formats for this device' : 'No exports available',
        icon: <Download className="w-4 h-4" />,
        type: 'summary',
        category: 'Export',
      },
    ];

    return cards;
  };

  // Filter cards based on search and tab
  const getFilteredCards = (cards: ViewCard[]): ViewCard[] => {
    return cards.filter(card => {
      const matchesTab = activeTab === 'summary' ? card.type === 'summary' : card.type === 'detail';
      const matchesSearch = searchQuery === '' || 
        card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  };

  // Toggle card selection
  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  // Select all filtered cards in current view
  const selectAllFilteredCards = () => {
    const cards = getAvailableCards(viewingWorkout);
    const filtered = getFilteredCards(cards);
    setSelectedCards(new Set(filtered.map(c => c.id)));
  };

  // Clear all selections
  const clearSelections = () => {
    setSelectedCards(new Set());
  };

  // Handle opening workout view with card selector
  const handleViewWorkout = (item: WorkoutHistoryItem) => {
    setViewingWorkout(item);
    setShowCardSelector(false); // Skip card selector, go straight to view
    setSelectedCards(new Set(['summary', 'blocks', 'exercises'])); // Default selections
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'garmin':
      case 'apple':
        return <Watch className="w-4 h-4" />;
      case 'zwift':
        return <Bike className="w-4 h-4" />;
      default:
        return <Dumbbell className="w-4 h-4" />;
    }
  };

  if (safeHistory.length === 0) {
    return (
      <div className="text-center py-16">
        <Dumbbell className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
        <h3 className="text-xl mb-2">No workout history yet</h3>
        <p className="text-muted-foreground mb-6">
          Create your first workout to see it here
        </p>
        <Button onClick={() => window.location.reload()}>
          Create Workout
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-1">Workout History</h2>
          <p className="text-sm text-muted-foreground">
            {safeHistory.length} workout{safeHistory.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
            className="gap-2"
          >
            <List className="w-4 h-4" />
            Cards
          </Button>
          <Button
            variant={viewMode === 'compact' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('compact')}
            className="gap-2"
          >
            <List className="w-4 h-4" />
            Compact
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className={viewMode === 'cards' ? 'space-y-2 pr-4' : 'space-y-1 pr-4'}>
          {safeHistory.map((item) => {
            // Safety check: ensure workout exists
            if (!item.workout) {
              console.warn('WorkoutHistory item missing workout data:', item);
              return (
                <Card key={item.id} className="hover:shadow-md transition-shadow border-orange-500/50">
                  <CardHeader>
                    <CardTitle className="text-lg text-orange-600">Invalid Workout Data</CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">This workout has missing data and cannot be displayed.</p>
                  </CardHeader>
                </Card>
              );
            }

            const exerciseCount = (item.workout.blocks || []).reduce(
              (sum, block) => {
                // Handle both old format (exercises directly on block) and new format (exercises in supersets)
                if (block?.supersets && block.supersets.length > 0) {
                  return sum + block.supersets.reduce((s, ss) => s + (ss?.exercises?.length || 0), 0);
                } else if (block?.exercises) {
                  return sum + (block.exercises.length || 0);
                }
                return sum;
              },
              0
            );

            // Compact view
            if (viewMode === 'compact') {
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold truncate">{item.workout?.title || 'Untitled Workout'}</h3>
                      {(item as any).isExported ? (
                        <Badge variant="default" className="bg-green-600 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Exported
                        </Badge>
                      ) : item.exports ? (
                        <Badge variant="secondary" className="text-xs">Ready</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Draft</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(item.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        {getDeviceIcon(item.device)}
                        <span className="capitalize">{item.device}</span>
                      </span>
                      <span>{item.workout.blocks?.length || 0} blocks</span>
                      <span>{exerciseCount} exercises</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewWorkout(item)}
                      className="h-8 w-8 p-0"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {onEditWorkout && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditWorkout(item)}
                        className="h-8 w-8 p-0"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onLoadWorkout(item)}
                      className="h-8 w-8 p-0"
                      title="Load"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    {item.exports && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleExport(item)}
                        className="h-8 w-8 p-0"
                        title="Export"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            }

            // Card view - improved readability
            return (
              <Card key={item.id} className="hover:shadow-md transition-all border-border/50 bg-card">
                <CardHeader className="pb-3 px-4 pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <CardTitle className="text-lg font-bold truncate text-foreground">
                        {item.workout?.title || 'Untitled Workout'}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">{formatDate(item.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          {getDeviceIcon(item.device)}
                          <span className="font-medium capitalize">{item.device}</span>
                        </div>
                        <div className="text-muted-foreground">
                          <span className="font-medium">{item.workout.blocks?.length || 0}</span> blocks
                        </div>
                        <div className="text-muted-foreground">
                          <span className="font-medium">{exerciseCount}</span> exercises
                        </div>
                        {item.syncedToStrava && (
                          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            Strava
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {(item as any).isExported ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                          <CheckCircle2 className="w-3 h-3 mr-1.5" />
                          Exported
                        </Badge>
                      ) : item.exports ? (
                        <Badge variant="secondary" className="font-medium">Ready to Export</Badge>
                      ) : (
                        <Badge variant="outline" className="font-medium">Draft</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 border-t bg-muted/20">
                  <div className="flex items-center justify-between gap-3 pt-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewWorkout(item)}
                        className="gap-2 h-9 font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                      {onEditWorkout && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEditWorkout(item)}
                          className="gap-2 h-9 font-medium"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => onLoadWorkout(item)}
                        className="gap-2 h-9 font-medium"
                      >
                        Load
                      </Button>
                      {item.exports && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExport(item)}
                          className="gap-2 h-9 font-medium"
                        >
                          <Download className="w-4 h-4" />
                          Export
                        </Button>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="h-9 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingId === item.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Card Selector Modal - Similar to Google Analytics */}
      <Dialog open={showCardSelector && !!viewingWorkout} onOpenChange={(open) => {
        if (!open) {
          setShowCardSelector(false);
          setViewingWorkout(null);
          setSelectedCards(new Set());
          setSearchQuery('');
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
          {viewingWorkout && (() => {
            const availableCards = getAvailableCards(viewingWorkout);
            const filteredCards = getFilteredCards(availableCards);
            const selectedCount = selectedCards.size;
            const totalCount = filteredCards.length;

            return (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                  <div className="flex items-center gap-4 flex-1">
                    <DialogTitle className="text-lg font-semibold">Add Cards</DialogTitle>
                    <span className="text-sm text-muted-foreground">
                      {selectedCount} of {totalCount} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowCardSelector(false);
                        setViewingWorkout(null);
                      }}
                      className="h-9 w-9"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="px-6 border-b">
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'summary' | 'detail')}>
                    <TabsList className="h-10">
                      <TabsTrigger value="summary">Summary Cards</TabsTrigger>
                      <TabsTrigger value="detail">Detail Cards</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Card Grid */}
                <ScrollArea className="flex-1 px-6 py-4">
                  <div className="space-y-4">
                    {/* Group by category */}
                    {Array.from(new Set(filteredCards.map(c => c.category))).map(category => {
                      const categoryCards = filteredCards.filter(c => c.category === category);
                      return (
                        <div key={category} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                              {category}
                            </h3>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {categoryCards.map((card) => {
                              const isSelected = selectedCards.has(card.id);
                              return (
                                <div
                                  key={card.id}
                                  className={`relative border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                                    isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                                  }`}
                                  onClick={() => toggleCardSelection(card.id)}
                                >
                                  <div className="flex items-start gap-3">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleCardSelection(card.id)}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <h4 className="text-sm font-medium text-foreground leading-tight">
                                          {card.title}
                                        </h4>
                                        <div className="text-muted-foreground shrink-0">
                                          {card.icon}
                                        </div>
                                      </div>
                                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                        {card.description}
                                      </p>
                                      <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide mt-2">
                                        From '{card.category}'
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* Footer Actions */}
                <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectedCount > 0 ? clearSelections : selectAllFilteredCards}
                      className="h-8 text-xs"
                    >
                      {selectedCount > 0 ? 'Clear Selection' : 'Select All'}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCardSelector(false);
                        setViewingWorkout(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        // Close selector and show workout view with selected cards
                        if (selectedCount > 0) {
                          setShowCardSelector(false);
                        }
                      }}
                      disabled={selectedCount === 0}
                    >
                      View Selected ({selectedCount})
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* View Workout Dialog - Shows selected cards */}
      <Dialog open={!!viewingWorkout && !showCardSelector} onOpenChange={(open) => !open && setViewingWorkout(null)}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] max-h-[90vh] overflow-y-auto p-0" style={{ maxWidth: '98vw', width: '98vw' }}>
          <div className="px-6 pt-4 pb-3 border-b flex items-center justify-between">
            <DialogHeader className="flex-1">
              <DialogTitle className="text-xl">{viewingWorkout?.workout?.title || 'Untitled Workout'}</DialogTitle>
              <DialogDescription>
                Workout details and structure
              </DialogDescription>
            </DialogHeader>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewingWorkout(null)}
              className="h-9 w-9 shrink-0 hover:bg-destructive/10 hover:text-destructive"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="px-6 py-4 overflow-y-auto flex-1">
          {viewingWorkout && (() => {
            const availableCards = getAvailableCards(viewingWorkout);
            const showSummary = selectedCards.has('summary') || selectedCards.size === 0;
            const showBlocks = selectedCards.has('blocks') || selectedCards.size === 0;
            const showExercises = selectedCards.has('exercises') || selectedCards.size === 0;
            const showValidation = selectedCards.has('validation') || selectedCards.size === 0;
            const showSources = selectedCards.has('sources') || selectedCards.size === 0;
            const showExport = selectedCards.has('export') || selectedCards.size === 0;

            return (
              <div className="space-y-6 py-4">
                {/* Summary Card */}
                {showSummary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Device</div>
                  <div className="font-medium capitalize">{viewingWorkout.device}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Blocks</div>
                  <div className="font-medium">{viewingWorkout.workout?.blocks?.length || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Exercises</div>
                  <div className="font-medium">
                    {(viewingWorkout.workout?.blocks || []).reduce((sum: number, block: any) => {
                      if (block?.supersets && block.supersets.length > 0) {
                        return sum + block.supersets.reduce((s: number, ss: any) => s + (ss?.exercises?.length || 0), 0);
                      } else if (block?.exercises) {
                        return sum + (block.exercises.length || 0);
                      }
                      return sum;
                    }, 0)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Created</div>
                  <div className="font-medium text-sm">{formatDate(viewingWorkout.createdAt)}</div>
                </div>
              </div>
                )}

                {/* Blocks Card - Grid Layout */}
                {showBlocks && viewingWorkout.workout?.blocks && viewingWorkout.workout.blocks.length > 0 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Workout Blocks</h3>
                      {viewingWorkout.validation && (
                        <Badge variant="secondary" className="text-xs">
                          Post-Validation (Mapped)
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {viewingWorkout.workout.blocks.map((block: any, blockIdx: number) => {
                        const exerciseCount = block.supersets && block.supersets.length > 0
                          ? block.supersets.reduce((sum: number, ss: any) => sum + (ss?.exercises?.length || 0), 0)
                          : (block.exercises?.length || 0);
                        
                        return (
                          <Card key={blockIdx} className="border-border/50 hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2 px-3 pt-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-sm font-semibold mb-0.5 leading-tight">
                                    {block.title || block.name || block.label || `Block ${blockIdx + 1}`}
                                  </CardTitle>
                                  {block.structure && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{block.structure}</p>
                                  )}
                                </div>
                                <div className="bg-primary/10 rounded-full p-1.5 shrink-0">
                                  <Layers className="w-3 h-3 text-primary" />
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0 px-3 pb-3 space-y-2">
                              {/* Supersets */}
                              {block.supersets && block.supersets.length > 0 && (
                                <div className="space-y-1.5">
                                  {block.supersets.map((superset: any, ssIdx: number) => (
                                    <div key={ssIdx} className="space-y-1">
                                      {superset.exercises && superset.exercises.length > 0 && (
                                        <>
                                          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                            Superset {ssIdx + 1}
                                          </div>
                                          <div className="space-y-1">
                                            {superset.exercises.map((exercise: any, exIdx: number) => {
                                              const originalName = exercise.name || exercise.exercise || 'Unknown Exercise';
                                              const mappedName = getMappedExerciseName(originalName, viewingWorkout.validation);
                                              const isMapped = mappedName !== originalName;
                                              
                                              return (
                                                <div key={exIdx} className="p-1.5 bg-muted/30 rounded border border-border/50">
                                                  <div className="flex items-start gap-1.5">
                                                    <div className="bg-primary/10 rounded-full p-0.5 shrink-0 mt-0.5">
                                                      <Dumbbell className="w-2.5 h-2.5 text-primary" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <div className="font-medium text-xs leading-tight mb-0.5">
                                                        {mappedName}
                                                      </div>
                                                      {isMapped && (
                                                        <div className="text-[9px] text-muted-foreground/70 italic mb-0.5">
                                                          was: {originalName}
                                                        </div>
                                                      )}
                                                      <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                                                        {exercise.sets && <span>({exercise.sets} sets)</span>}
                                                        {exercise.reps && <span>{exercise.reps} reps</span>}
                                                        {exercise.reps_range && <span>{exercise.reps_range}</span>}
                                                        {exercise.weight && <span>{exercise.weight}</span>}
                                                        {exercise.duration_sec && <span>{Math.round(exercise.duration_sec / 60)} min</span>}
                                                        {exercise.distance_m && <span>{exercise.distance_m}m</span>}
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Regular Exercises */}
                              {(!block.supersets || block.supersets.length === 0) && block.exercises && block.exercises.length > 0 && (
                                <div className="space-y-1">
                                  {block.exercises.map((exercise: any, exIdx: number) => {
                                    const originalName = exercise.name || exercise.exercise || 'Unknown Exercise';
                                    const mappedName = getMappedExerciseName(originalName, viewingWorkout.validation);
                                    const isMapped = mappedName !== originalName;
                                    
                                    return (
                                      <div key={exIdx} className="p-1.5 bg-muted/30 rounded border border-border/50">
                                        <div className="flex items-start gap-1.5">
                                          <div className="bg-primary/10 rounded-full p-0.5 shrink-0 mt-0.5">
                                            <Dumbbell className="w-2.5 h-2.5 text-primary" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium text-xs leading-tight mb-0.5">
                                              {mappedName}
                                            </div>
                                            {isMapped && (
                                              <div className="text-[9px] text-muted-foreground/70 italic mb-0.5">
                                                was: {originalName}
                                              </div>
                                            )}
                                            <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                                              {exercise.sets && <span>({exercise.sets} sets)</span>}
                                              {exercise.reps && <span>{exercise.reps} reps</span>}
                                              {exercise.reps_range && <span>{exercise.reps_range}</span>}
                                              {exercise.weight && <span>{exercise.weight}</span>}
                                              {exercise.duration_sec && <span>{Math.round(exercise.duration_sec / 60)} min</span>}
                                              {exercise.distance_m && <span>{exercise.distance_m}m</span>}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {/* Summary */}
                              <div className="pt-1.5 border-t border-border/50">
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                  <span>{exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}</span>
                                  {block.supersets && block.supersets.length > 0 && (
                                    <span>{block.supersets.length} superset{block.supersets.length !== 1 ? 's' : ''}</span>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sources Card */}
                {showSources && viewingWorkout.sources && viewingWorkout.sources.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Sources</h3>
                  <div className="space-y-2">
                    {viewingWorkout.sources.map((source: string, idx: number) => {
                      const [type, ...content] = source.split(':');
                      return (
                        <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1 uppercase">{type}</div>
                          <div className="text-sm whitespace-pre-wrap">{content.join(':')}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

                {/* Validation Card */}
                {showValidation && viewingWorkout.validation && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Validation Status</h3>
                    <Card className="border-border/50">
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Total Exercises</span>
                            <span className="font-semibold">{viewingWorkout.validation.total_exercises || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Validated</span>
                            <span className="font-semibold text-green-600">
                              {viewingWorkout.validation.validated_exercises?.length || 0}
                            </span>
                          </div>
                          {viewingWorkout.validation.needs_review && viewingWorkout.validation.needs_review.length > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Needs Review</span>
                              <span className="font-semibold text-yellow-600">
                                {viewingWorkout.validation.needs_review.length}
                              </span>
                            </div>
                          )}
                          {viewingWorkout.validation.unmapped_exercises && viewingWorkout.validation.unmapped_exercises.length > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Unmapped</span>
                              <span className="font-semibold text-red-600">
                                {viewingWorkout.validation.unmapped_exercises.length}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Export Card */}
                {showExport && viewingWorkout.exports && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Export Options</h3>
                    <Card className="border-border/50">
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          {viewingWorkout.exports.fit && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Garmin (.fit)</span>
                              <Badge variant="secondary">Available</Badge>
                            </div>
                          )}
                          {viewingWorkout.exports.plist && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Apple Watch (.plist)</span>
                              <Badge variant="secondary">Available</Badge>
                            </div>
                          )}
                          {viewingWorkout.exports.zwo && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Zwift (.zwo)</span>
                              <Badge variant="secondary">Available</Badge>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                {viewingWorkout.exports && (
                  <Button
                    onClick={() => handleExport(viewingWorkout)}
                    className="gap-2"
                    variant="default"
                  >
                    <Download className="w-4 h-4" />
                    Export to {viewingWorkout.device === 'garmin' ? 'Garmin' : viewingWorkout.device === 'apple' ? 'Apple Watch' : 'Zwift'}
                  </Button>
                )}
                {onEditWorkout && (
                  <Button
                    onClick={() => {
                      if (viewingWorkout) {
                        onEditWorkout(viewingWorkout);
                        setViewingWorkout(null);
                      }
                    }}
                    variant={viewingWorkout.exports ? "outline" : "default"}
                    className="gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Workout
                  </Button>
                )}
                <Button
                  onClick={() => {
                    if (viewingWorkout) {
                      onLoadWorkout(viewingWorkout);
                      setViewingWorkout(null);
                    }
                  }}
                  variant="outline"
                  className="gap-2"
                >
                  Load Workout
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setViewingWorkout(null)}
                >
                  Close
                </Button>
                </div>
              </div>
            );
          })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}