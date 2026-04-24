/**
 * Preview helpers shared across the 11 redesign preview entry points.
 * Wires up seed state, stub nav, and the correct frame (phone vs desktop).
 *
 * AMA-1595.
 */
import { useState } from 'react';
import {
  DesktopFrame,
  PhoneFrame,
  SEED_STATE,
  useRedesignTheme,
  type AppState,
  type Nav,
  type ScreenProps,
} from './ui';

type ScreenComponent = (props: ScreenProps) => React.ReactElement | null;

function useStubProps(): ScreenProps {
  const [state, setRawState] = useState<AppState>(SEED_STATE);
  const setState: ScreenProps['setState'] = (updater) =>
    setRawState((s) => updater(s));
  const nav: Nav = (target) => {
    // Preview routes are single-screen; log the target for visibility.
    // eslint-disable-next-line no-console
    console.info(`[redesign preview] nav('${target}') — ignored in single-screen preview`);
  };
  return { state, setState, nav };
}

export function PhonePreview({
  Screen,
  theme = 'light',
}: {
  Screen: ScreenComponent;
  theme?: 'light' | 'dark';
}) {
  useRedesignTheme(theme);
  const props = useStubProps();
  return (
    <PhoneFrame>
      <Screen {...props} />
    </PhoneFrame>
  );
}

export function DesktopPreview({
  Screen,
  theme = 'light',
}: {
  Screen: ScreenComponent;
  theme?: 'light' | 'dark';
}) {
  useRedesignTheme(theme);
  const props = useStubProps();
  return (
    <DesktopFrame>
      <Screen {...props} />
    </DesktopFrame>
  );
}
