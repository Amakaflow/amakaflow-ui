import { Monitor, ArrowDownToLine, ShieldCheck, Watch } from 'lucide-react';

const STATS = [
  {
    icon: <Monitor className="w-4 h-4" />,
    label: '6 Platforms Supported',
  },
  {
    icon: <ArrowDownToLine className="w-4 h-4" />,
    label: '5+ Import Sources',
  },
  {
    icon: <ShieldCheck className="w-4 h-4" />,
    label: 'AI + Human Validation',
  },
  {
    icon: <Watch className="w-4 h-4" />,
    label: 'Export to Garmin, Apple Watch, Zwift',
  },
];

export function TrustSignals() {
  return (
    <div className="rounded-xl border bg-muted/30 px-4 py-5 space-y-4">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {STATS.map((stat) => (
          <div key={stat.label} className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-primary">{stat.icon}</span>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Founder quote */}
      <blockquote className="border-l-2 border-primary pl-3">
        <p className="text-sm text-muted-foreground italic leading-relaxed">
          "I built AmakaFlow because I was tired of manually copying workouts from YouTube to my
          Garmin. Now I just paste the link."
        </p>
        <footer className="mt-1 text-xs font-medium">— David, Founder</footer>
      </blockquote>
    </div>
  );
}
