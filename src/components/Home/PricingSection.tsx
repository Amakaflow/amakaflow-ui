import { Zap, Users, Check } from 'lucide-react';
import { Badge } from '../ui/badge';

export function PricingSection() {
  return (
    <div className="space-y-3">
      {/* Compact header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pricing</h3>
        <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-xs px-2 py-0.5">
          Free During Beta
        </Badge>
      </div>

      {/* Compact tier row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {/* Free */}
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-semibold">Free</span>
          </div>
          <span className="text-xl font-bold">$0</span>
          <p className="text-[10px] text-muted-foreground mt-1">Import, structure, export</p>
          <div className="flex items-center justify-center gap-1 mt-1.5">
            <Check className="w-3 h-3 text-green-500" />
            <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Current plan</span>
          </div>
        </div>

        {/* Pro */}
        <div className="rounded-lg border border-border p-3 opacity-75">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-sm font-semibold">Pro</span>
          </div>
          <span className="text-xl font-bold">$9</span>
          <span className="text-[10px] text-muted-foreground">/mo</span>
          <p className="text-[10px] text-muted-foreground mt-1">Unlimited exports + AI</p>
          <p className="text-[10px] text-muted-foreground italic mt-1.5">Coming soon</p>
        </div>

        {/* Team */}
        <div className="rounded-lg border border-border p-3 opacity-75">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-sm font-semibold">Team</span>
          </div>
          <span className="text-xl font-bold">$29</span>
          <span className="text-[10px] text-muted-foreground">/mo</span>
          <p className="text-[10px] text-muted-foreground mt-1">Multi-user + bulk export</p>
          <p className="text-[10px] text-muted-foreground italic mt-1.5">Coming soon</p>
        </div>
      </div>

      <p className="text-center text-[10px] text-muted-foreground">
        No credit card required. Paid plans announced before launch.
      </p>
    </div>
  );
}
