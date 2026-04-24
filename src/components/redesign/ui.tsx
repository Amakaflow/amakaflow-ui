/**
 * AmakaFlow hi-fi UI kit — shadcn-parity primitives, CSS-class-driven.
 *
 * Ported from the Claude Design handoff (`hifi/ui.jsx`) to TypeScript. Design
 * tokens live in `src/styles/redesign-tokens.css` and attach via [data-theme].
 *
 * AMA-1595 (MVP UI design refresh · Card Stack direction).
 */
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type ReactNode,
  useLayoutEffect,
  useState,
} from 'react';

// ─── Icons ────────────────────────────────────────────────────────────────
export type IconName =
  | 'chevR' | 'chevL' | 'chevD' | 'chevU' | 'close' | 'plus'
  | 'play' | 'pause' | 'stop' | 'check' | 'swap' | 'edit'
  | 'heart' | 'run' | 'lift' | 'moon' | 'sun' | 'bolt'
  | 'flag' | 'bike' | 'watch' | 'home' | 'cal' | 'clock'
  | 'user' | 'info';

interface IconProps {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, style }: IconProps) {
  const stroke = {
    strokeWidth: 1.5,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const paths: Record<IconName, ReactNode> = {
    chevR: <polyline {...stroke} points="9 6 15 12 9 18" />,
    chevL: <polyline {...stroke} points="15 6 9 12 15 18" />,
    chevD: <polyline {...stroke} points="6 9 12 15 18 9" />,
    chevU: <polyline {...stroke} points="6 15 12 9 18 15" />,
    close: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" {...stroke} />
        <line x1="6" y1="6" x2="18" y2="18" {...stroke} />
      </>
    ),
    plus: (
      <>
        <line x1="12" y1="5" x2="12" y2="19" {...stroke} />
        <line x1="5" y1="12" x2="19" y2="12" {...stroke} />
      </>
    ),
    play: <polygon points="6 4 20 12 6 20 6 4" {...stroke} fill="currentColor" />,
    pause: (
      <>
        <rect x="6" y="4" width="4" height="16" {...stroke} />
        <rect x="14" y="4" width="4" height="16" {...stroke} />
      </>
    ),
    stop: <rect x="6" y="6" width="12" height="12" {...stroke} fill="currentColor" />,
    check: <polyline points="20 6 9 17 4 12" {...stroke} />,
    swap: (
      <>
        <polyline points="7 10 3 6 7 2" {...stroke} />
        <line x1="3" y1="6" x2="21" y2="6" {...stroke} />
        <polyline points="17 14 21 18 17 22" {...stroke} />
        <line x1="21" y1="18" x2="3" y2="18" {...stroke} />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" {...stroke} />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" {...stroke} />
      </>
    ),
    heart: (
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
        {...stroke}
      />
    ),
    run: (
      <>
        <circle cx="17" cy="5" r="2" {...stroke} />
        <path d="M4 22l4-5 2-6 4 2 3 4" {...stroke} />
        <path d="M8 11l-2 5" {...stroke} />
      </>
    ),
    lift: <path d="M6 6v12M18 6v12M3 8v8M21 8v8M6 12h12" {...stroke} />,
    moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" {...stroke} />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" {...stroke} />
        <path
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          {...stroke}
        />
      </>
    ),
    bolt: (
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none" />
    ),
    flag: (
      <>
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" {...stroke} />
        <line x1="4" y1="22" x2="4" y2="15" {...stroke} />
      </>
    ),
    bike: (
      <>
        <circle cx="5.5" cy="17.5" r="3.5" {...stroke} />
        <circle cx="18.5" cy="17.5" r="3.5" {...stroke} />
        <path
          d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"
          {...stroke}
        />
      </>
    ),
    watch: (
      <>
        <rect x="6" y="6" width="12" height="12" rx="2" {...stroke} />
        <path d="M9 6V3h6v3M9 18v3h6v-3" {...stroke} />
      </>
    ),
    home: <path d="M3 12l9-9 9 9M5 10v10h14V10" {...stroke} />,
    cal: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" {...stroke} />
        <line x1="16" y1="2" x2="16" y2="6" {...stroke} />
        <line x1="8" y1="2" x2="8" y2="6" {...stroke} />
        <line x1="3" y1="10" x2="21" y2="10" {...stroke} />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" {...stroke} />
        <polyline points="12 7 12 12 15 14" {...stroke} />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" {...stroke} />
        <path d="M4 21a8 8 0 0 1 16 0" {...stroke} />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" {...stroke} />
        <line x1="12" y1="16" x2="12" y2="12" {...stroke} />
        <line x1="12" y1="8" x2="12.01" y2="8" {...stroke} />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      style={{ display: 'inline-block', ...style }}
      width={size}
      height={size}
    >
      {paths[name]}
    </svg>
  );
}

// ─── Btn ──────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'ghost';
type BtnSize = 'sm' | 'md' | 'lg' | 'xl';

interface BtnProps {
  children: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  wide?: boolean;
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
  disabled?: boolean;
}

export function Btn({
  children,
  variant = 'primary',
  size = 'md',
  wide,
  onClick,
  style,
  disabled,
}: BtnProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`af-btn af-btn-${size} af-btn-${variant} ${wide ? 'af-btn-wide' : ''}`}
      style={{
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────
interface ChipProps {
  children: ReactNode;
  outline?: boolean;
  style?: CSSProperties;
  onClick?: (e: ReactMouseEvent<HTMLSpanElement>) => void;
}

export function Chip({ children, outline, style, onClick }: ChipProps) {
  return (
    <span
      onClick={onClick}
      className={`af-chip ${outline ? 'af-chip-outline' : ''}`}
      style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
    >
      {children}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  tight?: boolean;
  onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
}

export function Card({ children, style, tight, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`af-card ${tight ? 'af-card-tight' : ''}`}
      style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
    >
      {children}
    </div>
  );
}

// ─── Phone ────────────────────────────────────────────────────────────────
interface PhoneProps {
  children: ReactNode;
  statusbar?: boolean;
  time?: string;
}

export function Phone({ children, statusbar = true, time = '6:14' }: PhoneProps) {
  return (
    <div className="af-phone">
      <div className="af-phone-body">
        {statusbar && (
          <div className="af-statusbar">
            <span>{time}</span>
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10 }}>●●●●</span>
              <span style={{ fontSize: 10 }}>▲</span>
              <span style={{ marginLeft: 2 }}>100</span>
            </span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ─── Desk ─────────────────────────────────────────────────────────────────
interface DeskProps {
  children: ReactNode;
  url?: string;
}

export function Desk({ children, url = 'amakaflow.app' }: DeskProps) {
  return (
    <div className="af-desk">
      <div className="af-desk-chrome">
        <div className="dot" />
        <div className="dot" />
        <div className="dot" />
        <div className="af-desk-url">{url}</div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────
interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function Sheet({ open, onClose, children, title }: SheetProps) {
  if (!open) return null;
  return (
    <div className="af-sheet-backdrop" onClick={onClose}>
      <div className="af-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="af-sheet-handle" />
        {title && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div className="af-h2">{title}</div>
            <div
              onClick={onClose}
              style={{
                cursor: 'pointer',
                color: 'var(--fg-muted)',
                padding: 4,
              }}
            >
              <Icon name="close" size={18} />
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ─── Ring gauge ───────────────────────────────────────────────────────────
interface RingProps {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
}

export function Ring({ value, size = 88, stroke = 6, label }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  const color =
    value >= 70
      ? 'var(--ready-high)'
      : value >= 45
        ? 'var(--ready-mod)'
        : 'var(--ready-low)';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--border)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <div
          className="af-mono"
          style={{
            fontSize: size * 0.32,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </div>
        {label && (
          <div className="af-label" style={{ fontSize: 8, marginTop: 2 }}>
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TabBar ───────────────────────────────────────────────────────────────
interface TabBarProps {
  active?: number;
  onChange?: (i: number) => void;
}

export function TabBar({ active = 0, onChange }: TabBarProps) {
  const items: { name: string; icon: IconName }[] = [
    { name: 'Today', icon: 'home' },
    { name: 'Plan', icon: 'cal' },
    { name: 'History', icon: 'clock' },
    { name: 'You', icon: 'user' },
  ];
  return (
    <div className="af-tabbar">
      {items.map((it, i) => (
        <div
          key={it.name}
          className="af-tab"
          data-active={i === active}
          onClick={() => onChange && onChange(i)}
        >
          <Icon name={it.icon} size={20} />
          <span>{it.name}</span>
        </div>
      ))}
    </div>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────
interface TopBarProps {
  title?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  onLeft?: () => void;
  onRight?: () => void;
  sub?: ReactNode;
}

export function TopBar({ title, left, right, onLeft, onRight, sub }: TopBarProps) {
  return (
    <div style={{ padding: '8px 20px 14px', flexShrink: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 32,
        }}
      >
        <div
          onClick={onLeft}
          style={{
            cursor: onLeft ? 'pointer' : 'default',
            color: 'var(--fg-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {typeof left === 'string' && left.startsWith('<') ? (
            <Icon name="chevL" size={18} />
          ) : null}
          {typeof left === 'string' ? left.replace(/^</, '') : left}
        </div>
        <div
          onClick={onRight}
          style={{
            cursor: onRight ? 'pointer' : 'default',
            color: 'var(--fg-muted)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {right}
        </div>
      </div>
      {title && (
        <div className="af-h1" style={{ marginTop: 8 }}>
          {title}
        </div>
      )}
      {sub && (
        <div className="af-muted" style={{ fontSize: 12, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Spark ────────────────────────────────────────────────────────────────
interface SparkProps {
  points: number[];
  w?: number;
  h?: number;
  color?: string;
}

export function Spark({ points, w = 100, h = 28, color = 'var(--fg)' }: SparkProps) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Bars ─────────────────────────────────────────────────────────────────
interface BarsProps {
  values: number[];
  h?: number;
  accent?: number;
  w?: number;
}

export function Bars({ values, h = 48, accent = -1, w = 100 }: BarsProps) {
  const max = Math.max(...values);
  const bw = (w - (values.length - 1) * 2) / values.length;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {values.map((v, i) => {
        const bh = (v / max) * h;
        return (
          <rect
            key={i}
            x={i * (bw + 2)}
            y={h - bh}
            width={bw}
            height={bh}
            fill={i === accent ? 'var(--ready-high)' : 'var(--fg)'}
            opacity={i === accent ? 1 : 0.85}
          />
        );
      })}
    </svg>
  );
}

// ─── Shared state types ───────────────────────────────────────────────────
export interface HistoryItem {
  date: string;
  type: 'Run' | 'Ride' | 'Lift' | string;
  title: string;
  dur: string;
  rpe: number;
  manual?: boolean;
}

export interface AppState {
  tab: number;
  readiness: number;
  onboarded: boolean;
  paired: boolean;
  history: HistoryItem[];
  toast: string | null;
}

export type SetAppState = (updater: (s: AppState) => AppState) => void;

export type NavTarget =
  | 'home'
  | 'workouts'
  | 'detail'
  | 'player'
  | 'completion'
  | 'onboarding'
  | 'pairing'
  | 'history'
  | 'settings'
  | 'paywall'
  | 'landing'
  | 'swap-from-home';

export type Nav = (target: NavTarget) => void;

export interface ScreenProps {
  state: AppState;
  setState: SetAppState;
  nav: Nav;
}

// Seed data used by every preview shell.
export const SEED_STATE: AppState = {
  tab: 0,
  readiness: 84,
  onboarded: true,
  paired: true,
  toast: null,
  history: [
    { date: 'Yesterday', type: 'Ride', title: 'Recovery spin', dur: '40 min', rpe: 3 },
    { date: 'Apr 22', type: 'Run', title: 'Aerobic base, 75% MAF', dur: '48 min', rpe: 4 },
    { date: 'Apr 21', type: 'Lift', title: 'Lower body — posterior', dur: '52 min', rpe: 7 },
    { date: 'Apr 19', type: 'Run', title: 'Long endurance run', dur: '1h 38m', rpe: 6 },
    { date: 'Apr 18', type: 'Lift', title: 'Upper body — push focus', dur: '45 min', rpe: 6 },
  ],
};

// Helper: hook that applies the redesign theme to :root while a preview renders.
export function useRedesignTheme(theme: 'light' | 'dark' = 'light') {
  useLayoutEffect(() => {
    const prev = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', theme);
    return () => {
      if (prev) document.documentElement.setAttribute('data-theme', prev);
      else document.documentElement.removeAttribute('data-theme');
    };
  }, [theme]);
}

// Helper: wrap a screen in the phone shell used by the prototype canvas.
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="af"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'var(--bg-subtle)',
      }}
    >
      <div className="af-phone">
        <div className="af-phone-body">
          <div className="af-statusbar">
            <span>6:14</span>
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10 }}>●●●●</span>
              <span style={{ fontSize: 10 }}>▲</span>
              <span style={{ marginLeft: 2 }}>100</span>
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// Helper: wrap a desktop screen in the browser-chrome shell.
export function DesktopFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="af"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'var(--bg-subtle)',
      }}
    >
      <Desk>{children}</Desk>
    </div>
  );
}

// Re-exports of commonly used React hooks/types so screen files can import
// everything from one place.
export { useState };
export type { CSSProperties, MutableRefObject, ReactNode };
export type { ReactKeyboardEvent };
