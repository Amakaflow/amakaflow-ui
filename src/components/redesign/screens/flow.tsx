/**
 * AmakaFlow hi-fi screens — Onboarding, Pairing, History, Settings.
 *
 * Ported from `hifi/screens-flow.jsx` (Claude Design handoff, AMA-1595).
 */
import { useRef, useState } from 'react';
import {
  Bars,
  Btn,
  Card,
  Chip,
  Icon,
  TabBar,
  TopBar,
  type IconName,
  type ScreenProps,
} from '../ui';

// ─── Onboarding ───────────────────────────────────────────────────────────
interface Question {
  k: string;
  title: string;
  sub?: string;
  slider?: boolean;
  multi?: boolean;
  options?: { v: string; label: string; hint?: string }[];
}

type Answers = {
  goal: string | null;
  hours: number;
  modality: string[];
  experience: string | null;
  injury: string | null;
};

export function OnboardingScreen({ nav, setState }: ScreenProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    goal: null,
    hours: 8,
    modality: [],
    experience: null,
    injury: null,
  });

  const q: Question[] = [
    {
      k: 'goal',
      title: 'What are you training for?',
      sub: 'Primary goal · pick one',
      options: [
        { v: 'hyrox', label: 'Hyrox / hybrid race', hint: 'Mixed endurance + strength' },
        { v: 'ultra', label: 'Ultra or marathon', hint: 'Long-distance endurance' },
        { v: 'tri', label: 'Triathlon', hint: 'Swim / bike / run' },
        { v: 'gpp', label: 'General fitness', hint: 'Strong, fast, durable' },
      ],
    },
    {
      k: 'hours',
      title: 'How many hours per week?',
      sub: 'Honest average — coach will adapt',
      slider: true,
    },
    {
      k: 'modality',
      title: 'Which modalities?',
      sub: 'Pick all that apply',
      multi: true,
      options: [
        { v: 'run', label: 'Running' },
        { v: 'lift', label: 'Strength' },
        { v: 'ride', label: 'Cycling' },
        { v: 'row', label: 'Rowing / erg' },
        { v: 'swim', label: 'Swimming' },
      ],
    },
    {
      k: 'experience',
      title: 'Training experience?',
      options: [
        { v: 'new', label: 'New to structured training', hint: '0–1 years' },
        { v: 'inter', label: 'Intermediate', hint: '1–3 years consistent' },
        { v: 'adv', label: 'Advanced', hint: '3+ years, races regularly' },
      ],
    },
    {
      k: 'injury',
      title: 'Any current injuries or limits?',
      sub: 'Optional — helps coach avoid re-aggravation',
      options: [
        { v: 'none', label: 'None right now' },
        { v: 'knee', label: 'Knee' },
        { v: 'back', label: 'Lower back' },
        { v: 'ankle', label: 'Ankle / Achilles' },
        { v: 'other', label: 'Something else', hint: 'Add detail later' },
      ],
    },
  ];

  const cur = q[step];
  const total = q.length;
  const val = answers[cur.k as keyof Answers];
  const answered = cur.slider
    ? true
    : cur.multi
      ? (val as string[])?.length > 0
      : !!val;

  const set = (v: string) => {
    if (cur.multi) {
      setAnswers((a) => {
        const arr = a.modality;
        return {
          ...a,
          modality: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v],
        };
      });
    } else {
      setAnswers((a) => ({ ...a, [cur.k]: v }));
    }
  };

  const next = () => {
    if (step < total - 1) setStep(step + 1);
    else {
      setState((s) => ({
        ...s,
        onboarded: true,
        toast: 'Coaching profile ready',
      }));
      nav('pairing');
    }
  };

  return (
    <>
      <div
        style={{
          padding: '14px 20px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          onClick={() => step > 0 && setStep(step - 1)}
          style={{
            color: step > 0 ? 'var(--fg-muted)' : 'var(--fg-dim)',
            cursor: step > 0 ? 'pointer' : 'default',
          }}
        >
          <Icon name="chevL" size={20} />
        </div>
        <div className="af-prog" style={{ flex: 1 }}>
          <div
            className="af-prog-fill"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
        <div
          className="af-mono"
          style={{ fontSize: 11, color: 'var(--fg-muted)' }}
        >
          {step + 1}/{total}
        </div>
      </div>

      <div
        className="af-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px 24px 20px',
        }}
      >
        <div className="af-label">COACHING PROFILE</div>
        <div className="af-h1" style={{ marginTop: 6, fontSize: 24 }}>
          {cur.title}
        </div>
        {cur.sub && (
          <div className="af-muted" style={{ fontSize: 13, marginTop: 8 }}>
            {cur.sub}
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          {cur.slider ? (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div
                  className="af-mono"
                  style={{
                    fontSize: 56,
                    fontWeight: 500,
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                  }}
                >
                  {answers.hours}
                </div>
                <div className="af-label" style={{ marginTop: 6 }}>
                  HOURS PER WEEK
                </div>
              </div>
              <input
                type="range"
                min="2"
                max="18"
                value={answers.hours}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, hours: +e.target.value }))
                }
                style={{ width: '100%', accentColor: 'var(--fg)' }}
              />
              <div
                className="af-mono"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: 'var(--fg-muted)',
                  marginTop: 6,
                }}
              >
                <span>2</span>
                <span>10</span>
                <span>18+</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cur.options!.map((o) => {
                const sel = cur.multi
                  ? (val as string[])?.includes(o.v)
                  : val === o.v;
                return (
                  <button
                    key={o.v}
                    onClick={() => set(o.v)}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: `1px solid ${sel ? 'var(--fg)' : 'var(--border)'}`,
                      background: sel ? 'var(--accent-bg)' : 'var(--bg-elev)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: cur.multi ? 4 : 999,
                        border: `1.5px solid ${sel ? 'var(--fg)' : 'var(--border-str)'}`,
                        background: sel ? 'var(--fg)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--bg)',
                        flexShrink: 0,
                      }}
                    >
                      {sel && <Icon name="check" size={12} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>
                        {o.label}
                      </div>
                      {o.hint && (
                        <div
                          className="af-muted"
                          style={{ fontSize: 11, marginTop: 2 }}
                        >
                          {o.hint}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '12px 20px 18px' }}>
        <Btn wide size="lg" onClick={next} disabled={!answered}>
          {step === total - 1 ? 'Finish · pair watch' : 'Continue'}
          <Icon name="chevR" size={14} />
        </Btn>
      </div>
    </>
  );
}

// ─── Pairing ──────────────────────────────────────────────────────────────
export function PairingScreen({ nav, setState }: ScreenProps) {
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const onKey = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 1);
    setCode((c) => {
      const n = [...c];
      n[i] = d;
      return n;
    });
    setError('');
    if (d && i < 5) inputs.current[i + 1]?.focus();
  };

  const onBack = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const submit = () => {
    const full = code.join('');
    if (full.length !== 6) {
      setError('Enter all 6 digits');
      return;
    }
    setBusy(true);
    setError('');
    setTimeout(() => {
      if (full === '000000') {
        setError('Code invalid — check your watch');
        setBusy(false);
      } else {
        setSuccess(true);
        setTimeout(() => {
          setState((s) => ({ ...s, paired: true, toast: 'Watch paired' }));
          nav('home');
        }, 900);
      }
    }, 900);
  };

  return (
    <>
      <TopBar
        left={<Icon name="close" size={20} />}
        onLeft={() => nav('home')}
      />
      <div
        className="af-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '4px 24px 20px' }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'var(--accent-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
          }}
        >
          <Icon name="watch" size={26} />
        </div>
        <div className="af-label">PAIR WATCH</div>
        <div className="af-h1" style={{ marginTop: 6 }}>
          Enter the 6-digit code
        </div>
        <div
          className="af-muted"
          style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}
        >
          Open AmakaFlow on your Garmin watch. A pairing code will appear — enter it below.
        </div>

        <div style={{ display: 'flex', gap: 8, margin: '30px 0 10px' }}>
          {code.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              onChange={(e) => onKey(i, e.target.value)}
              onKeyDown={(e) => onBack(i, e)}
              inputMode="numeric"
              maxLength={1}
              className="af-mono"
              style={{
                flex: 1,
                height: 56,
                textAlign: 'center',
                fontSize: 22,
                fontWeight: 500,
                border: `1px solid ${
                  success
                    ? 'var(--ready-high)'
                    : error
                      ? 'var(--destructive)'
                      : d
                        ? 'var(--fg)'
                        : 'var(--border-str)'
                }`,
                borderRadius: 10,
                background: 'var(--bg-elev)',
                color: 'var(--fg)',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          ))}
        </div>
        {error && (
          <div style={{ color: 'var(--destructive)', fontSize: 12 }}>{error}</div>
        )}
        {success && (
          <div
            style={{
              color: 'var(--ready-high)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon name="check" size={12} /> Paired successfully
          </div>
        )}

        <div
          style={{
            marginTop: 28,
            padding: 14,
            border: '1px solid var(--border)',
            borderRadius: 10,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <Icon
            name="info"
            size={16}
            style={{
              color: 'var(--fg-muted)',
              flexShrink: 0,
              marginTop: 1,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>
              Don't see the code?
            </div>
            <div
              className="af-muted"
              style={{ fontSize: 11, marginTop: 3, lineHeight: 1.5 }}
            >
              Install AmakaFlow from Connect IQ, then open the app on your watch. Bluetooth must be on.
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 20px 18px' }}>
        <Btn
          wide
          size="lg"
          onClick={submit}
          disabled={busy || code.join('').length !== 6 || success}
        >
          {busy ? 'Pairing…' : success ? 'Paired' : 'Pair watch'}
        </Btn>
        <div style={{ height: 4 }} />
        <Btn wide size="md" variant="ghost" onClick={() => nav('home')}>
          Skip for now
        </Btn>
      </div>
    </>
  );
}

// ─── History ──────────────────────────────────────────────────────────────
export function HistoryScreen({ state, setState }: ScreenProps) {
  const items = state.history;
  return (
    <>
      <TopBar
        title="History"
        sub={`${items.length} sessions · last 30 days`}
      />
      <div
        className="af-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}
      >
        <Card tight style={{ padding: 14, marginBottom: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: 10,
            }}
          >
            <div>
              <div className="af-label">LOAD · LAST 4 WEEKS</div>
              <div
                className="af-mono"
                style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}
              >
                412{' '}
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>TSS</span>
              </div>
            </div>
            <Chip>
              <span className="af-dot af-dot-high" /> Optimal
            </Chip>
          </div>
          <Bars values={[280, 340, 385, 412]} h={36} accent={3} w={280} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
              color: 'var(--fg-muted)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>W-3</span>
            <span>W-2</span>
            <span>W-1</span>
            <span>THIS</span>
          </div>
        </Card>

        <div className="af-seg" style={{ marginBottom: 12 }}>
          <div className="af-seg-item" data-on={true}>All</div>
          <div className="af-seg-item" data-on={false}>Run</div>
          <div className="af-seg-item" data-on={false}>Strength</div>
          <div className="af-seg-item" data-on={false}>Ride</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((h, i) => {
            const icon: IconName =
              h.type === 'Run'
                ? 'run'
                : h.type === 'Ride'
                  ? 'bike'
                  : h.type === 'Lift'
                    ? 'lift'
                    : 'flag';
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom:
                    i < items.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'var(--accent-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={icon} size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {h.title}
                    </span>
                    {h.manual && (
                      <Chip
                        outline
                        style={{ fontSize: 9, padding: '2px 6px' }}
                      >
                        MANUAL
                      </Chip>
                    )}
                  </div>
                  <div
                    className="af-muted af-mono"
                    style={{ fontSize: 11, marginTop: 2 }}
                  >
                    {h.date} · {h.dur} · RPE {h.rpe}
                  </div>
                </div>
                <Icon
                  name="chevR"
                  size={14}
                  style={{ color: 'var(--fg-dim)' }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <TabBar
        active={2}
        onChange={(i) => setState((s) => ({ ...s, tab: i }))}
      />
    </>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────
export function SettingsScreen({ setState, nav }: ScreenProps) {
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [haptics, setHaptics] = useState(true);
  const [notifs, setNotifs] = useState(true);
  const [autoSwap, setAutoSwap] = useState(true);
  const [themePref, setThemePref] = useState<'light' | 'dark' | 'system'>('system');

  return (
    <>
      <TopBar title="You" />
      <div
        className="af-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}
      >
        <Card
          style={{
            padding: 16,
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: 'var(--accent-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="user" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="af-h3">Adaeze K.</div>
            <div className="af-muted af-mono" style={{ fontSize: 11, marginTop: 2 }}>
              Hyrox · 8h/wk · Intermediate
            </div>
          </div>
          <Icon name="chevR" size={14} style={{ color: 'var(--fg-dim)' }} />
        </Card>

        <div className="af-label" style={{ marginBottom: 8 }}>
          SUBSCRIPTION
        </div>
        <Card
          onClick={() => nav('paywall')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Free plan</div>
            <div className="af-muted" style={{ fontSize: 11, marginTop: 2 }}>
              Upgrade for adaptive coaching
            </div>
          </div>
          <Chip>Upgrade</Chip>
        </Card>

        <div className="af-label" style={{ marginBottom: 8 }}>
          DEVICES
        </div>
        <Card tight style={{ padding: '10px 14px', marginBottom: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 0',
            }}
          >
            <Icon name="watch" size={16} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>Garmin Forerunner 965</div>
              <div
                className="af-muted af-mono"
                style={{
                  fontSize: 10,
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span
                  className="af-dot af-dot-high"
                  style={{ width: 6, height: 6, boxShadow: 'none' }}
                />
                CONNECTED · SYNCED 2M AGO
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn
              variant="ghost"
              size="sm"
              wide
              onClick={() => nav('pairing')}
            >
              Pair another
            </Btn>
          </div>
        </Card>

        <div className="af-label" style={{ marginBottom: 8 }}>
          PREFERENCES
        </div>
        <Card tight style={{ padding: 0, marginBottom: 18 }}>
          <div style={{ padding: '0 14px' }}>
            <div className="af-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>Units</div>
              </div>
              <div className="af-seg" style={{ width: 150 }}>
                <div
                  className="af-seg-item"
                  data-on={units === 'metric'}
                  onClick={() => setUnits('metric')}
                >
                  km
                </div>
                <div
                  className="af-seg-item"
                  data-on={units === 'imperial'}
                  onClick={() => setUnits('imperial')}
                >
                  mi
                </div>
              </div>
            </div>
            <div className="af-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>Morning check-in</div>
                <div
                  className="af-muted"
                  style={{ fontSize: 11, marginTop: 2 }}
                >
                  6:00am notification
                </div>
              </div>
              <div
                className="af-switch"
                data-on={notifs}
                onClick={() => setNotifs(!notifs)}
              />
            </div>
            <div className="af-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>Auto-swap when fatigued</div>
                <div
                  className="af-muted"
                  style={{ fontSize: 11, marginTop: 2 }}
                >
                  Suggest alternatives if readiness low
                </div>
              </div>
              <div
                className="af-switch"
                data-on={autoSwap}
                onClick={() => setAutoSwap(!autoSwap)}
              />
            </div>
            <div className="af-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>Haptics</div>
              </div>
              <div
                className="af-switch"
                data-on={haptics}
                onClick={() => setHaptics(!haptics)}
              />
            </div>
          </div>
        </Card>

        <div className="af-label" style={{ marginBottom: 8 }}>
          APPEARANCE
        </div>
        <div className="af-seg" style={{ marginBottom: 18 }}>
          {(['light', 'dark', 'system'] as const).map((t) => (
            <div
              key={t}
              className="af-seg-item"
              data-on={themePref === t}
              onClick={() => setThemePref(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            borderTop: '1px solid var(--border)',
          }}
        >
          {['Export data', 'Support', 'Privacy', 'Sign out'].map((x) => (
            <div
              key={x}
              style={{
                padding: '14px 0',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: 13,
                color: x === 'Sign out' ? 'var(--destructive)' : 'var(--fg)',
              }}
            >
              {x}
              <Icon name="chevR" size={14} style={{ color: 'var(--fg-dim)' }} />
            </div>
          ))}
        </div>
        <div
          className="af-muted af-mono"
          style={{ fontSize: 10, textAlign: 'center', marginTop: 20 }}
        >
          AMAKAFLOW v1.0.0 · BUILD 2026.04.24
        </div>
      </div>
      <TabBar
        active={3}
        onChange={(i) => setState((s) => ({ ...s, tab: i }))}
      />
    </>
  );
}
