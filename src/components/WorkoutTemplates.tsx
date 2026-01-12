import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  BookTemplate,
  History,
  Plus,
  Download,
  Clock,
  CheckCircle,
  Circle,
  ChevronDown,
  ChevronRight,
  Timer
} from 'lucide-react';
import { WorkoutStructure } from '../types/workout';
import {
  getWorkoutHistory,
  getTemplatesByCategory,
  templateCategoryLabels,
  TemplateCategory,
  CategorizedWorkoutStructure
} from '../lib/templates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

interface WorkoutTemplatesProps {
  onSelectTemplate: (workout: WorkoutStructure) => void;
  onSelectHistory: (workout: WorkoutStructure) => void;
}

// Category display order
const categoryOrder: TemplateCategory[] = [
  'strength',
  'hiit',
  'quick',
  'emom-amrap',
  'focus',
  'superset',
  'cardio',
];

export function WorkoutTemplates({ onSelectTemplate, onSelectHistory }: WorkoutTemplatesProps) {
  const [history] = useState(getWorkoutHistory());
  const [expandedCategories, setExpandedCategories] = useState<Set<TemplateCategory>>(
    new Set(['strength', 'hiit', 'quick']) // Default expanded categories
  );

  // Group templates by category
  const templatesByCategory = useMemo(() => getTemplatesByCategory(), []);

  const toggleCategory = (category: TemplateCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getExerciseCount = (workout: WorkoutStructure) => {
    return workout.blocks.reduce((sum, block) => {
      // Count exercises in block-level exercises array
      const blockExercises = block.exercises?.length || 0;
      // Count exercises in supersets
      const supersetExercises = block.supersets?.reduce((s, ss) => s + (ss.exercises?.length || 0), 0) || 0;
      return sum + blockExercises + supersetExercises;
    }, 0);
  };

  const renderTemplateCard = (template: CategorizedWorkoutStructure, idx: number) => (
    <Card key={idx} className="hover:border-primary transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">{template.title}</CardTitle>
            <CardDescription className="text-xs mt-1 flex items-center gap-2">
              {template.blocks.length} block(s) • {getExerciseCount(template)} exercises
              {template.duration && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    {template.duration}
                  </span>
                </>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2 mb-3">
          {template.blocks.slice(0, 2).map((block, blockIdx) => (
            <Badge key={blockIdx} variant="secondary" className="text-xs">
              {block.label}
            </Badge>
          ))}
          {template.blocks.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{template.blocks.length - 2} more
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => onSelectTemplate(template)}
          className="w-full"
        >
          <Plus className="w-3 h-3 mr-2" />
          Use Template
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookTemplate className="w-5 h-5" />
          Templates & History
        </CardTitle>
        <CardDescription>
          Start from a template or load a previous workout
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="templates">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="templates">
              <BookTemplate className="w-4 h-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {categoryOrder.map(category => {
                  const templates = templatesByCategory.get(category);
                  if (!templates || templates.length === 0) return null;

                  const isExpanded = expandedCategories.has(category);
                  const categoryLabel = templateCategoryLabels[category];

                  return (
                    <Collapsible
                      key={category}
                      open={isExpanded}
                      onOpenChange={() => toggleCategory(category)}
                    >
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="font-medium text-sm">{categoryLabel}</span>
                          <Badge variant="secondary" className="text-xs ml-1">
                            {templates.length}
                          </Badge>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-3 mt-2 ml-6">
                          {templates.map((template, idx) => renderTemplateCard(template, idx))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history">
            <ScrollArea className="h-[400px] pr-4">
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No workout history yet</p>
                  <p className="text-xs mt-1">Your created workouts will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <Card key={item.id} className="hover:border-primary transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base">{item.workout.title}</CardTitle>
                            <CardDescription className="text-xs mt-1 flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {formatDate(item.createdAt)}
                            </CardDescription>
                          </div>
                          {item.exported ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-xs text-muted-foreground mb-3 truncate">
                          {item.workout.source}
                        </div>
                        <div className="flex gap-2 mb-3">
                          <Badge variant="outline" className="text-xs">
                            {item.workout.blocks.length} blocks
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getExerciseCount(item.workout)} exercises
                          </Badge>
                          {item.exported && (
                            <Badge className="text-xs bg-green-600">Exported</Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSelectHistory(item.workout)}
                          className="w-full"
                        >
                          <Download className="w-3 h-3 mr-2" />
                          Load Workout
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
