const IMPORT_SOURCES = [
  { emoji: '▶️', label: 'YouTube' },
  { emoji: '📸', label: 'Instagram' },
  { emoji: '🎵', label: 'TikTok' },
  { emoji: '📌', label: 'Pinterest' },
  { emoji: '📄', label: 'CSV / FIT' },
];

const EXPORT_TARGETS = [
  { emoji: '⌚', label: 'Garmin' },
  { emoji: '🍎', label: 'Apple Watch' },
  { emoji: '🚴', label: 'Zwift' },
];

const FILE_FORMATS = [
  { label: 'FIT' },
  { label: 'TCX' },
  { label: 'JSON' },
];

export function SupportedDevices() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Works with your gear</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Import From */}
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Import From
          </p>
          <div className="flex flex-wrap gap-3">
            {IMPORT_SOURCES.map((src) => (
              <div
                key={src.label}
                className="flex flex-col items-center gap-1 rounded-lg border bg-background px-3 py-2 min-w-[64px] text-center"
              >
                <span className="text-xl leading-none">{src.emoji}</span>
                <span className="text-xs text-muted-foreground">{src.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Export To */}
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Export To
          </p>
          <div className="flex flex-wrap gap-3">
            {EXPORT_TARGETS.map((tgt) => (
              <div
                key={tgt.label}
                className="flex flex-col items-center gap-1 rounded-lg border bg-background px-3 py-2 min-w-[64px] text-center"
              >
                <span className="text-xl leading-none">{tgt.emoji}</span>
                <span className="text-xs text-muted-foreground">{tgt.label}</span>
              </div>
            ))}
            {/* File formats */}
            <div className="flex items-center gap-1.5 self-end mb-1">
              {FILE_FORMATS.map((fmt) => (
                <span
                  key={fmt.label}
                  className="rounded border bg-background px-1.5 py-0.5 text-xs font-mono text-muted-foreground"
                >
                  {fmt.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
