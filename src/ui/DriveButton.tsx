// A big press-and-hold button for driving. It reports "down" for as long as a finger
// (or mouse) is on it, and lets go cleanly if the touch is cancelled or slides away.
import type { PointerEvent } from 'react';

const ROTATION = { up: 0, right: 90, down: 180, left: 270 };

interface Props {
  label: string;
  dir: keyof typeof ROTATION;
  held: boolean;
  go?: boolean;
  onChange(down: boolean): void;
}

export default function DriveButton({ label, dir, held, go, onChange }: Props) {
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(true);
  };
  const up = () => onChange(false);
  return (
    <button
      type="button"
      className={'drive' + (go ? ' go' : '') + (held ? ' held' : '')}
      aria-label={label}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${ROTATION[dir]}deg)` }}>
        <path d="M12 4.5 20 14h-5v5.5H9V14H4z" />
      </svg>
    </button>
  );
}
