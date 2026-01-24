/**
 * Balance indicators showing push/pull and upper/lower ratios.
 *
 * Part of AMA-483: Volume Analytics Dashboard
 */

import { Scale, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { isPushMuscle, isPullMuscle, isUpperMuscle, isLowerMuscle, formatVolume } from './constants';

interface BalanceIndicatorsProps {
  muscleGroupBreakdown: Record<string, number> | null;
  isLoading?: boolean;
}

type BalanceStatus = 'balanced' | 'slight-imbalance' | 'imbalanced';

function getBalanceStatus(ratio: number): BalanceStatus {
  if (ratio >= 0.8 && ratio <= 1.2) return 'balanced';
  if ((ratio >= 0.5 && ratio < 0.8) || (ratio > 1.2 && ratio <= 1.5)) return 'slight-imbalance';
  return 'imbalanced';
}

function getStatusColor(status: BalanceStatus): string {
  switch (status) {
    case 'balanced':
      return 'bg-green-500';
    case 'slight-imbalance':
      return 'bg-yellow-500';
    case 'imbalanced':
      return 'bg-red-500';
  }
}

function getStatusLabel(status: BalanceStatus): string {
  switch (status) {
    case 'balanced':
      return 'Balanced';
    case 'slight-imbalance':
      return 'Slightly Off';
    case 'imbalanced':
      return 'Needs Attention';
  }
}

function getStatusVariant(status: BalanceStatus): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'balanced':
      return 'default';
    case 'slight-imbalance':
      return 'secondary';
    case 'imbalanced':
      return 'destructive';
  }
}

function calculateRatio(
  breakdown: Record<string, number>,
  groupACheck: (muscle: string) => boolean,
  groupBCheck: (muscle: string) => boolean
): { ratio: number; groupA: number; groupB: number } {
  let groupA = 0;
  let groupB = 0;

  Object.entries(breakdown).forEach(([muscle, volume]) => {
    if (groupACheck(muscle)) {
      groupA += volume;
    }
    if (groupBCheck(muscle)) {
      groupB += volume;
    }
  });

  // Return ratio (groupA / groupB), defaulting to 1 if groupB is 0
  const ratio = groupB > 0 ? groupA / groupB : groupA > 0 ? 2 : 1;

  return { ratio, groupA, groupB };
}

interface BalanceGaugeProps {
  ratio: number;
  leftLabel: string;
  rightLabel: string;
  leftVolume: number;
  rightVolume: number;
}

function BalanceGauge({ ratio, leftLabel, rightLabel, leftVolume, rightVolume }: BalanceGaugeProps) {
  const status = getBalanceStatus(ratio);
  const statusColor = getStatusColor(status);

  // Calculate position on the gauge (0-100)
  // ratio of 0.5 = 0%, ratio of 1 = 50%, ratio of 1.5 = 100%
  const clampedRatio = Math.max(0.5, Math.min(1.5, ratio));
  const position = ((clampedRatio - 0.5) / 1) * 100;

  const statusLabel = getStatusLabel(status);

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <div>
          <span className="font-medium">{leftLabel}</span>
          <span className="text-muted-foreground ml-2">{formatVolume(leftVolume)}</span>
        </div>
        <div>
          <span className="text-muted-foreground mr-2">{formatVolume(rightVolume)}</span>
          <span className="font-medium">{rightLabel}</span>
        </div>
      </div>

      <div
        className="relative"
        role="meter"
        aria-label={`${leftLabel} to ${rightLabel} balance ratio`}
        aria-valuenow={ratio}
        aria-valuemin={0.5}
        aria-valuemax={1.5}
        aria-valuetext={`${ratio.toFixed(2)} to 1, ${statusLabel}`}
      >
        {/* Background track */}
        <div className="h-3 rounded-full bg-gradient-to-r from-red-200 via-green-200 to-red-200" aria-hidden="true" />

        {/* Balanced zone indicator */}
        <div
          className="absolute top-0 h-3 bg-green-100/50"
          style={{ left: '30%', width: '40%' }}
          aria-hidden="true"
        />

        {/* Position indicator */}
        <div
          className={`absolute top-0 h-3 w-3 rounded-full ${statusColor} border-2 border-white shadow-sm transition-all duration-300`}
          style={{ left: `calc(${position}% - 6px)` }}
          data-testid="balance-indicator"
          aria-hidden="true"
        />

        {/* Center line */}
        <div className="absolute top-0 left-1/2 h-3 w-0.5 bg-green-600 -translate-x-1/2" aria-hidden="true" />
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">
          Ratio: {ratio.toFixed(2)}:1
        </span>
        <Badge variant={getStatusVariant(status)} className="text-xs">
          {getStatusLabel(status)}
        </Badge>
      </div>
    </div>
  );
}

export function BalanceIndicators({ muscleGroupBreakdown, isLoading }: BalanceIndicatorsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2" data-testid="balance-indicators-loading">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!muscleGroupBreakdown || Object.keys(muscleGroupBreakdown).length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2" data-testid="balance-indicators-empty">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Scale className="w-4 h-4" />
              Push / Pull Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-sm py-4 text-center">
              No volume data available
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              Upper / Lower Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-sm py-4 text-center">
              No volume data available
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pushPull = calculateRatio(muscleGroupBreakdown, isPushMuscle, isPullMuscle);
  const upperLower = calculateRatio(muscleGroupBreakdown, isUpperMuscle, isLowerMuscle);

  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="balance-indicators">
      <Card data-testid="push-pull-balance">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Push / Pull Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceGauge
            ratio={pushPull.ratio}
            leftLabel="Push"
            rightLabel="Pull"
            leftVolume={pushPull.groupA}
            rightVolume={pushPull.groupB}
          />
        </CardContent>
      </Card>

      <Card data-testid="upper-lower-balance">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4" />
            Upper / Lower Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceGauge
            ratio={upperLower.ratio}
            leftLabel="Upper"
            rightLabel="Lower"
            leftVolume={upperLower.groupA}
            rightVolume={upperLower.groupB}
          />
        </CardContent>
      </Card>
    </div>
  );
}
