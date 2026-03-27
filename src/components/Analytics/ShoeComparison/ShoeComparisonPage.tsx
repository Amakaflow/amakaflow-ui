/**
 * ShoeComparisonPage — main page for shoe performance comparison (AMA-1112).
 *
 * Shows shoe cards with metrics, a comparison bar chart, and an AI recommendation.
 */

import { useShoeComparison } from './hooks/useShoeComparison';
import { ShoeCard } from './ShoeCard';
import { ComparisonChart } from './ComparisonChart';
import { Card, CardContent } from '../../ui/card';

export function ShoeComparisonPage() {
  const { data, isLoading, error } = useShoeComparison();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="shoe-comparison-loading">
        <p className="text-muted-foreground">Loading shoe data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="shoe-comparison-error">
        <p className="text-destructive">Failed to load shoe comparison data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="shoe-comparison-page">
      <div>
        <h2 className="text-2xl font-semibold">Shoe Performance Comparison</h2>
        <p className="text-muted-foreground mt-1">
          {data.total_runs_analyzed} runs analyzed across {data.shoes.length} shoes
          &mdash; Stryd + Strava data
        </p>
      </div>

      {/* Shoe cards */}
      <div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        data-testid="shoe-cards-grid"
      >
        {data.shoes.map((shoe) => (
          <ShoeCard key={shoe.shoe_name} shoe={shoe} />
        ))}
      </div>

      {/* Comparison chart */}
      <ComparisonChart shoes={data.shoes} />

      {/* Recommendation */}
      <Card data-testid="shoe-recommendation">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Recommendation</h3>
          <p className="text-muted-foreground leading-relaxed">{data.recommendation}</p>
        </CardContent>
      </Card>
    </div>
  );
}
