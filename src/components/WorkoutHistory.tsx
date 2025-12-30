import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Clock, Dumbbell, Watch, Bike, Download, Activity, CheckCircle2, ExternalLink, Eye, Trash2, ChevronRight, Edit, List, Search, BarChart3, FileText, Layers, Play, X, Video, Link2, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { WorkoutHistoryItem } from '../lib/workout-history';
import { isAccountConnectedSync } from '../lib/linked-accounts';
import { DeviceId, getDeviceById } from '../lib/devices';
import { ViewWorkout } from './ViewWorkout';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { FollowAlongUrlEditor } from './FollowAlongUrlEditor';
import { exportAndDownload, CsvStyle, ExportFormat } from '../lib/export-api';

type Props = {
  history: WorkoutHistoryItem[];
  onLoadWorkout: (item: WorkoutHistoryItem) => void;
  onEditWorkout?: (item: WorkoutHistoryItem) => void;
  onUpdateWorkout?: (item: WorkoutHistoryItem) => Promise<void>;
  onDeleteWorkout: (id: string) => void;
  onBulkDeleteWorkouts?: (ids: string[]) => Promise<void> | void;
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

export function WorkoutHistory({ history, onLoadWorkout, onEditWorkout, onUpdateWorkout, onDeleteWorkout, onBulkDeleteWorkouts, onEnhanceStrava }: Props) {
  const stravaConnected = isAccountConnectedSync('strava');
  const [viewingWorkout, setViewingWorkout] = useState<WorkoutHistoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('compact');
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'summary' | 'detail'>('summary');
  const [showCardSelector, setShowCardSelector] = useState(false);
  
  // Modal and undo state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(0); // 0-based page index
  const [deviceFilter, setDeviceFilter] = useState<'all' | string>('all');
  const PAGE_SIZE = 10;
  
  // Ensure history is an array
  const safeHistory = Array.isArray(history) ? history : [];
  
  // Derive available devices from history
  const availableDevices = Array.from(
    new Set(
      safeHistory
        .map((item) => item.device)
        .filter((d): d is string => Boolean(d))
    )
  ).sort((a, b) => a.localeCompare(b));
  
  // Apply search filter
  const filteredHistory = safeHistory.filter((item) => {
    // SEARCH FILTER
    const hasSearch = searchQuery.trim().length > 0;
    let matchesSearch = true;

    if (hasSearch) {
      const q = searchQuery.toLowerCase();
      const title = item.workout?.title?.toLowerCase?.() ?? '';
      const deviceName = item.device?.toLowerCase?.() ?? '';
      const status = item.workout?.status?.toLowerCase?.() ?? '';

      matchesSearch =
        title.includes(q) ||
        deviceName.includes(q) ||
        status.includes(q);
    }

    if (!matchesSearch) return false;

    // DEVICE FILTER
    if (deviceFilter !== 'all') {
      return item.device === deviceFilter;
    }

    return true;
  });

  // Pagination over filtered list
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const currentPageIndex = Math.min(pageIndex, totalPages - 1);
  const pageStart = currentPageIndex * PAGE_SIZE;
  const displayedHistory = filteredHistory.slice(pageStart, pageStart + PAGE_SIZE);
  
  // Selection state for bulk delete
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isAllSelected =
    displayedHistory.length > 0 &&
    displayedHistory.every((item) => selectedIds.includes(item.id || ''));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Unselect only items on the current page
      setSelectedIds((prev) =>
        prev.filter((id) => !displayedHistory.some((item) => item.id === id))
      );
    } else {
      // Select all items on the current page, keeping previous selections
      const idsOnPage = displayedHistory
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id));

      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...idsOnPage]))
      );
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const handleBulkDeleteClick = () => {
    if (!onBulkDeleteWorkouts || selectedIds.length === 0) return;

    setPendingDeleteIds(selectedIds);
    setShowDeleteModal(true);
  };

  const confirmBulkDelete = () => {
    if (!onBulkDeleteWorkouts || pendingDeleteIds.length === 0) return;

    // Perform delete via parent handler
    onBulkDeleteWorkouts(pendingDeleteIds);

    // Clear selection and pending ids
    clearSelection();
    setPendingDeleteIds([]);

    // Close modal
    setShowDeleteModal(false);
  };

    const cancelBulkDelete = () => {
    setPendingDeleteIds([]);
    setShowDeleteModal(false);
  };

  const handleDeleteClick = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    
    setDeletingId(confirmDeleteId);
    try {
      await onDeleteWorkout(confirmDeleteId);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteId(null);
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

  // Helper to download pre-generated export file (FIT, plist, ZWO)
  const handleExportPregenerated = (item: WorkoutHistoryItem) => {
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

  // Export to CSV format via API
  const handleCsvExport = async (item: WorkoutHistoryItem, style: CsvStyle) => {
    try {
      await exportAndDownload(item.workout, 'csv', { csvStyle: style });
    } catch (error) {
      console.error('CSV export failed:', error);
    }
  };

  // Export to other formats via API (FIT, TCX, Text)
  const handleApiExport = async (item: WorkoutHistoryItem, format: ExportFormat) => {
    try {
      await exportAndDownload(item.workout, format);
    } catch (error) {
      console.error(`${format.toUpperCase()} export failed:`, error);
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
        <p className="text-muted-foreground mb-4">
          Your saved workouts will appear here. To get started:
        </p>
        <div className="text-sm text-muted-foreground mb-6 space-y-1">
          <p>1. Create a workout (YouTube, Instagram, or manual entry)</p>
          <p>2. Validate and map exercises</p>
          <p>3. Click "Save Workout" in the Publish & Export step</p>
        </div>
        <Button onClick={() => { window.location.href = "/"; }}>
          Create Your First Workout
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-[360px]">
            <h2 className="text-lg font-semibold mb-3">
              Delete {pendingDeleteIds.length} workout(s)?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelBulkDelete}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmBulkDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-1">Workout History</h2>
          <p className="text-sm text-muted-foreground">
            {filteredHistory.length} workout{filteredHistory.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPageIndex(0); // reset to first page when searching
            }}
            placeholder="Search workouts..."
            className="h-8 w-48 rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <select
            value={deviceFilter}
            onChange={(e) => {
              setDeviceFilter(e.target.value);
              setPageIndex(0); // reset to first page when filter changes
            }}
            className="h-8 rounded-md border px-2 text-sm bg-background"
          >
            <option value="all">All devices</option>
            {availableDevices.map((device) => (
              <option key={device} value={device}>
                {device}
              </option>
            ))}
          </select>
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={toggleSelectAll}
            aria-label="Select all workouts"
            className="w-4 h-4"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectedIds.length === 0}
            onClick={handleBulkDeleteClick}
            className="gap-2"
          >
            Delete selected ({selectedIds.length})
          </Button>
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
        <div className={viewMode === 'cards' ? 'space-y-2 pr-4 max-w-7xl mx-auto' : 'space-y-1 pr-4 max-w-7xl mx-auto'}>
          {displayedHistory.map((item) => {
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
                  className={`flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors group ${
                    selectedIds.includes(item.id || '') ? 'bg-muted/40 border-primary/40' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id || '')}
                    onChange={() => toggleSelect(item.id || '')}
                    aria-label="Select workout"
                    className="w-4 h-4 flex-shrink-0"
                  />
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          title="Export"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleCsvExport(item, 'strong')}>
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          CSV (Strong/Hevy)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCsvExport(item, 'extended')}>
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          CSV (Extended)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {item.exports && (
                          <DropdownMenuItem onClick={() => handleExportPregenerated(item)}>
                            <Download className="w-4 h-4 mr-2" />
                            {item.device === 'garmin' ? 'FIT File' : item.device === 'apple' ? 'Apple Workout' : 'ZWO File'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleApiExport(item, 'fit')}>
                          <Activity className="w-4 h-4 mr-2" />
                          FIT (Garmin)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleApiExport(item, 'tcx')}>
                          <FileText className="w-4 h-4 mr-2" />
                          TCX
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleApiExport(item, 'text')}>
                          <FileText className="w-4 h-4 mr-2" />
                          Text (TrainingPeaks)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClick(item.id)}
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
              <Card key={item.id} className={`hover:shadow-md transition-all border-border/50 bg-card ${
                selectedIds.includes(item.id || '') ? 'bg-muted/40 border-primary/40 shadow-sm' : ''
              }`}>
                <CardHeader className="pb-3 px-4 pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id || '')}
                      onChange={() => toggleSelect(item.id || '')}
                      aria-label="Select workout"
                      className="w-4 h-4 flex-shrink-0 mt-1"
                    />
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
                      {/* Workout Settings Badges */}
                      {(item.workout?.settings?.workoutWarmup?.enabled || item.workout?.settings?.defaultRestType) && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {item.workout?.settings?.workoutWarmup?.enabled && (
                            <Badge variant="outline" className="text-xs">
                              Warm-up: {item.workout.settings.workoutWarmup.activity === 'custom'
                                ? 'Custom'
                                : `${Math.floor((item.workout.settings.workoutWarmup.durationSec || 300) / 60)}min`}
                            </Badge>
                          )}
                          {item.workout?.settings?.defaultRestType && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Clock className="w-3 h-3" />
                              Rest: {item.workout.settings.defaultRestType === 'button'
                                ? 'Lap Button'
                                : item.workout.settings.defaultRestSec
                                  ? `${item.workout.settings.defaultRestSec}s`
                                  : 'Timed'}
                            </Badge>
                          )}
                        </div>
                      )}
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 h-9 font-medium"
                          >
                            <Download className="w-4 h-4" />
                            Export
                            <ChevronDown className="w-3 h-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleCsvExport(item, 'strong')}>
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            CSV (Strong/Hevy compatible)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCsvExport(item, 'extended')}>
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            CSV (Extended for spreadsheets)
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {item.exports && (
                            <DropdownMenuItem onClick={() => handleExportPregenerated(item)}>
                              <Download className="w-4 h-4 mr-2" />
                              {item.device === 'garmin' ? 'FIT File (pre-generated)' : item.device === 'apple' ? 'Apple Workout' : 'ZWO File'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleApiExport(item, 'fit')}>
                            <Activity className="w-4 h-4 mr-2" />
                            FIT (Garmin)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleApiExport(item, 'tcx')}>
                            <FileText className="w-4 h-4 mr-2" />
                            TCX
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleApiExport(item, 'text')}>
                            <FileText className="w-4 h-4 mr-2" />
                            Text (TrainingPeaks)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClick(item.id)}
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

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
        <div>
          Showing{' '}
          {filteredHistory.length === 0
            ? 0
            : pageStart + 1}{' '}
          –{' '}
          {Math.min(pageStart + PAGE_SIZE, filteredHistory.length)}{' '}
          of{' '}
          {filteredHistory.length}{' '}
          workout{filteredHistory.length === 1 ? '' : 's'}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPageIndex === 0}
            onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
          >
            Previous
          </Button>
          <span>
            Page {currentPageIndex + 1} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPageIndex >= totalPages - 1}
            onClick={() =>
              setPageIndex((prev) =>
                Math.min(totalPages - 1, prev + 1)
              )
            }
          >
            Next
          </Button>
        </div>
      </div>

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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && handleDeleteCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workout? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={!!deletingId}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={!!deletingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Workout Modal - Shows workout details */}
      {viewingWorkout && !showCardSelector && (
        <ViewWorkout
          workout={viewingWorkout}
          onClose={() => setViewingWorkout(null)}
        />
      )}
    </div>
  );
}