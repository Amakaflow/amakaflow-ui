import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import type { DeviceConfig } from '../../lib/devices';
import type { WorkoutStructure } from '../../types/workout';

interface ExportPreviewProps {
  workout: WorkoutStructure | null;
  device: DeviceConfig | null;
}

function StructuralPreview({ workout }: { workout: WorkoutStructure }) {
  return (
    <div className="space-y-3 text-sm">
      {(workout.blocks || []).map((block, i) => (
        <div key={block.id ?? block.label ?? i} className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{block.label}</span>
            {block.structure && (
              <Badge variant="outline" className="text-xs">{block.structure}</Badge>
            )}
          </div>
          <div className="pl-3 space-y-0.5">
            {(block.exercises || []).map((ex, j) => (
              <p key={ex.id ?? ex.name ?? j} className="text-muted-foreground text-xs">
                {ex.name}
                {ex.sets ? ` · ${ex.sets} sets` : ''}
                {ex.reps ? ` × ${ex.reps}` : ''}
                {ex.reps_range ? ` × ${ex.reps_range}` : ''}
                {ex.duration_sec ? ` · ${ex.duration_sec}s` : ''}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DevicePreview({ workout, device }: { workout: WorkoutStructure; device: DeviceConfig | null }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border-2 border-muted p-3 bg-muted/20 font-mono text-xs space-y-2">
        <div className="flex items-center justify-between border-b border-muted pb-1">
          <span className="font-bold text-sm">{workout.title}</span>
          <span className="text-muted-foreground">{device?.icon} {device?.name}</span>
        </div>
        {(workout.blocks || []).map((block, i) => (
          <div key={block.id ?? block.label ?? i}>
            <p className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
              {block.label} {block.structure ? `[${block.structure.toUpperCase()}]` : ''}
            </p>
            {(block.exercises || []).map((ex, j) => (
              <p key={ex.id ?? ex.name ?? j} className="pl-2 text-xs">
                {ex.sets ? `${ex.sets}×` : ''}{ex.reps ? `${ex.reps} ` : ''}{ex.reps_range ? `${ex.reps_range} ` : ''}{ex.name}
              </p>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Simulated {device?.name ?? 'device'} display</p>
    </div>
  );
}

function FormatPreview({ workout, device }: { workout: WorkoutStructure; device: DeviceConfig | null }) {
  const format = device?.format ?? 'JSON';
  const preview = JSON.stringify(
    {
      title: workout.title,
      format,
      blocks: (workout.blocks || []).map(b => ({
        label: b.label,
        structure: b.structure,
        exercises: (b.exercises || []).map(e => e.name),
      })),
    },
    null,
    2
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{format}</Badge>
        <span className="text-xs text-muted-foreground">Preview</span>
      </div>
      <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-64 font-mono">{preview}</pre>
    </div>
  );
}

export function ExportPreview({ workout, device }: ExportPreviewProps) {
  if (!workout) {
    return (
      <Card className="h-full" data-testid="export-preview">
        <CardContent className="flex items-center justify-center h-40">
          <p className="text-sm text-muted-foreground">Select a workout to preview</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full" data-testid="export-preview">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="device">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="structural">Structural</TabsTrigger>
            <TabsTrigger value="device">Device</TabsTrigger>
            <TabsTrigger value="format">Format</TabsTrigger>
          </TabsList>
          <TabsContent value="structural">
            <StructuralPreview workout={workout} />
          </TabsContent>
          <TabsContent value="device">
            <DevicePreview workout={workout} device={device} />
          </TabsContent>
          <TabsContent value="format">
            <FormatPreview workout={workout} device={device} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
