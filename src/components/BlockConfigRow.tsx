import { useState } from 'react';
import type { Block, WarmupActivity } from '../types/workout';
import { formatRestSecs, formatMMSS } from '../lib/workout-utils';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  format,
  step = 1,
}: {
  value: number | null;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  step?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const display = value != null ? (format ? format(value) : String(value)) : '—';

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="-"
        onClick={() => onChange(Math.max(min, (value ?? 0) - step))}
        className="w-7 h-7 rounded border bg-background hover:bg-muted flex items-center justify-center text-sm font-medium select-none"
      >
        −
      </button>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => {
            const n = parseInt(draft, 10);
            if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
            setEditing(false);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-16 text-center text-sm border rounded px-1 py-0.5"
        />
      ) : (
        <span
          className="min-w-[3.5rem] text-center text-sm font-medium cursor-pointer hover:underline underline-offset-2"
          onClick={() => { setDraft(String(value ?? 0)); setEditing(true); }}
        >
          {display}
        </span>
      )}
      <button
        type="button"
        aria-label="+"
        onClick={() => onChange(Math.min(max, (value ?? 0) + step))}
        className="w-7 h-7 rounded border bg-background hover:bg-muted flex items-center justify-center text-sm font-medium select-none"
      >
        +
      </button>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// ── Warmup activity options ───────────────────────────────────────────────────

const ACTIVITY_OPTIONS: { value: WarmupActivity; label: string }[] = [
  { value: 'stretching', label: 'Stretching' },
  { value: 'jump_rope', label: 'Jump Rope' },
  { value: 'air_bike', label: 'Air Bike' },
  { value: 'treadmill', label: 'Treadmill' },
  { value: 'stairmaster', label: 'Stairmaster' },
  { value: 'rowing', label: 'Rowing' },
  { value: 'custom', label: 'Custom' },
];

// ── BlockConfigRow ────────────────────────────────────────────────────────────

export function BlockConfigRow({
  block,
  onUpdate,
}: {
  block: Block;
  onUpdate: (updates: Partial<Block>) => void;
}) {
  const { structure } = block;

  if (structure === 'circuit' || structure === 'rounds') {
    return (
      <div className="flex flex-wrap gap-6 p-3 bg-muted/30 rounded-lg border-t">
        <Field label="Rounds">
          <Stepper
            value={block.rounds ?? null}
            onChange={v => onUpdate({ rounds: v })}
            min={1}
            max={99}
          />
        </Field>
        <Field label="Rest between rounds">
          <Stepper
            value={block.rest_between_rounds_sec ?? null}
            onChange={v => onUpdate({ rest_between_rounds_sec: v })}
            min={0}
            step={5}
            format={formatRestSecs}
          />
        </Field>
      </div>
    );
  }

  if (structure === 'emom') {
    const timeCap = block.time_cap_sec != null ? Math.round(block.time_cap_sec / 60) : null;
    return (
      <div className="flex flex-wrap gap-6 p-3 bg-muted/30 rounded-lg border-t">
        <Field label="Rounds">
          <Stepper
            value={block.rounds ?? null}
            onChange={v => onUpdate({ rounds: v })}
            min={1}
            max={99}
          />
        </Field>
        <Field label="Time Cap (min)">
          <Stepper
            value={timeCap}
            onChange={v => onUpdate({ time_cap_sec: v * 60 })}
            min={1}
            max={120}
          />
        </Field>
      </div>
    );
  }

  if (structure === 'amrap') {
    return (
      <div className="flex flex-wrap gap-6 p-3 bg-muted/30 rounded-lg border-t">
        <Field label="Time Cap">
          <Stepper
            value={block.time_cap_sec ?? null}
            onChange={v => onUpdate({ time_cap_sec: v })}
            min={60}
            step={60}
            format={formatMMSS}
          />
        </Field>
      </div>
    );
  }

  if (structure === 'tabata') {
    return (
      <div className="flex flex-wrap gap-6 p-3 bg-muted/30 rounded-lg border-t">
        <Field label="Work">
          <Stepper
            value={block.time_work_sec ?? null}
            onChange={v => onUpdate({ time_work_sec: v })}
            min={5}
            step={5}
            format={v => `${v}s`}
          />
        </Field>
        <Field label="Rest per interval">
          <Stepper
            value={block.time_rest_sec ?? null}
            onChange={v => onUpdate({ time_rest_sec: v })}
            min={0}
            step={5}
            format={v => `${v}s`}
          />
        </Field>
        <Field label="Rounds">
          <Stepper
            value={block.rounds ?? null}
            onChange={v => onUpdate({ rounds: v })}
            min={1}
            max={40}
          />
        </Field>
      </div>
    );
  }

  if (structure === 'for-time') {
    return (
      <div className="flex flex-wrap gap-6 p-3 bg-muted/30 rounded-lg border-t">
        <Field label="Time Cap (optional)">
          <Stepper
            value={block.time_cap_sec ?? null}
            onChange={v => onUpdate({ time_cap_sec: v })}
            min={0}
            step={60}
            format={v => v > 0 ? formatMMSS(v) : 'No cap'}
          />
        </Field>
      </div>
    );
  }

  if (structure === 'sets' || structure === 'regular') {
    return (
      <div className="flex flex-wrap gap-6 p-3 bg-muted/30 rounded-lg border-t">
        <Field label="Sets">
          <Stepper
            value={block.sets ?? null}
            onChange={v => onUpdate({ sets: v })}
            min={1}
            max={20}
          />
        </Field>
        <Field label="Rest between sets">
          <Stepper
            value={block.rest_between_sets_sec ?? null}
            onChange={v => onUpdate({ rest_between_sets_sec: v })}
            min={0}
            step={5}
            format={formatRestSecs}
          />
        </Field>
      </div>
    );
  }

  if (structure === 'superset') {
    return (
      <div className="flex flex-wrap gap-6 p-3 bg-muted/30 rounded-lg border-t">
        <Field label="Rounds">
          <Stepper
            value={block.rounds ?? null}
            onChange={v => onUpdate({ rounds: v })}
            min={1}
            max={20}
          />
        </Field>
        <Field label="Rest after pair">
          <Stepper
            value={block.rest_between_rounds_sec ?? null}
            onChange={v => onUpdate({ rest_between_rounds_sec: v })}
            min={0}
            step={5}
            format={formatRestSecs}
          />
        </Field>
      </div>
    );
  }

  if (structure === 'warmup' || structure === 'cooldown') {
    return (
      <div className="flex flex-wrap gap-6 p-3 bg-muted/30 rounded-lg border-t">
        <Field label="Duration">
          <Stepper
            value={block.warmup_duration_sec ?? null}
            onChange={v => onUpdate({ warmup_duration_sec: v })}
            min={60}
            step={60}
            format={v => {
              const m = Math.floor(v / 60);
              const s = v % 60;
              return s > 0 ? `${m}m ${s}s` : `${m} min`;
            }}
          />
        </Field>
        <Field label="Activity">
          <Select
            value={block.warmup_activity ?? 'stretching'}
            onValueChange={v => onUpdate({ warmup_activity: v as WarmupActivity })}
          >
            <SelectTrigger className="h-8 text-sm w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    );
  }

  // null / unknown structure — nothing to configure yet
  return null;
}
