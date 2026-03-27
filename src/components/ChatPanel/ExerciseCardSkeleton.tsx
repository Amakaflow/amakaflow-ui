interface ExerciseCardSkeletonProps {
  count?: number;
}

export function ExerciseCardSkeleton({ count = 3 }: ExerciseCardSkeletonProps) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/50 px-3 py-2.5 animate-pulse"
          data-testid="exercise-card-skeleton"
        >
          <div className="mt-0.5 rounded-md bg-muted h-7 w-7 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded bg-muted" />
            <div className="h-2.5 w-1/2 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
