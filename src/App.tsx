import { useCallback, useEffect, useRef, useState } from 'react';
import { LEVELS } from './game/levels';
import { createGame, type Game, type InputKey } from './game/game';
import DriveButton from './ui/DriveButton';

const VEHICLES = [
  { id: 'car', label: 'Car', paint: 0 },
  { id: 'auto', label: 'Auto', paint: 3 }
];

const PAINTS = [
  { name: 'Yellow', hex: '#f2b705' },
  { name: 'Red', hex: '#d7263d' },
  { name: 'Blue', hex: '#1b7fbd' },
  { name: 'Green', hex: '#1f8a4c' },
  { name: 'White', hex: '#eef0ee' }
];

const KEYS: Record<string, InputKey> = {
  ArrowUp: 'fwd', w: 'fwd', W: 'fwd',
  ArrowDown: 'back', s: 'back', S: 'back',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right'
};

const SAVE_KEY = 'little-cruisers:unlocked';

/** The highest level the child has unlocked (1 = only the first). Falls back to 1 if storage is blocked. */
function loadUnlocked(): number {
  try {
    const n = Number(localStorage.getItem(SAVE_KEY));
    return Number.isInteger(n) && n >= 1 ? Math.min(n, LEVELS.length) : 1;
  } catch {
    return 1;
  }
}
function saveUnlocked(n: number) {
  try { localStorage.setItem(SAVE_KEY, String(n)); } catch { /* private mode: progress lasts until the page closes */ }
}

const CONFETTI = ['#d7263d', '#ffd23f', '#1b7fbd', '#2fa84f', '#ff8a1f', '#b36bff'];

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [failed, setFailed] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [vehicle, setVehicle] = useState('car');
  // Which paint each vehicle is wearing, so the right swatch stays ringed when you switch.
  const [paintOf, setPaintOf] = useState<Record<string, number>>(
    () => Object.fromEntries(VEHICLES.map((v) => [v.id, v.paint]))
  );
  const [level, setLevel] = useState(1);
  const [unlocked, setUnlocked] = useState(loadUnlocked);
  const [progress, setProgress] = useState({ done: 0, total: LEVELS[0].bays.length });
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shake, setShake] = useState<{ id: number; n: number } | null>(null); // the locked card to wiggle
  const [finished, setFinished] = useState<{ level: number; fresh: boolean } | null>(null);
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;
  const [held, setHeld] = useState<Record<InputKey, boolean>>({ fwd: false, back: false, left: false, right: false });

  useEffect(() => {
    if (!canvasRef.current || !stageRef.current) return;
    let game: Game;
    try {
      game = createGame(canvasRef.current, stageRef.current, {
        onSpeed: setSpeed,
        onProgress: (done, total) => {
          setProgress({ done, total });
          if (done > 0 && done < total) setToast(`Parked! ${done} of ${total}`);
          else setToast(null);
        },
        onLevelComplete: (lvl) => {
          const next = Math.min(lvl + 1, LEVELS.length);
          const fresh = next > unlockedRef.current;
          if (fresh) { setUnlocked(next); saveUnlocked(next); }
          setFinished({ level: lvl, fresh });
        }
      });
    } catch {
      setFailed(true);
      return;
    }
    gameRef.current = game;
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const press = useCallback((key: InputKey, down: boolean) => {
    gameRef.current?.setInput(key, down);
    setHeld((h) => (h[key] === down ? h : { ...h, [key]: down }));
  }, []);

  // Keyboard driving for laptops and desktops.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const k = KEYS[e.key];
      if (k) { e.preventDefault(); press(k, true); }
    };
    const onUp = (e: KeyboardEvent) => {
      const k = KEYS[e.key];
      if (k) press(k, false);
    };
    const release = () => (['fwd', 'back', 'left', 'right'] as InputKey[]).forEach((k) => press(k, false));
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', release);
    };
  }, [press]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const overlayOpen = menuOpen || finished !== null;
  useEffect(() => {
    if (overlayOpen) (['fwd', 'back', 'left', 'right'] as InputKey[]).forEach((k) => press(k, false));
  }, [overlayOpen, press]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const startLevel = (n: number) => {
    gameRef.current?.setLevel(n);
    setLevel(n);
    setMenuOpen(false);
    setFinished(null);
    setToast(null);
  };
  const tapLevel = (n: number) => {
    if (n <= unlocked) startLevel(n);
    else setShake((k) => ({ id: n, n: (k?.n ?? 0) + 1 }));
  };

  const pickVehicle = (id: string) => {
    gameRef.current?.selectVehicle(id);
    setVehicle(id);
  };
  const pickPaint = (i: number) => {
    gameRef.current?.paint(PAINTS[i].hex);
    setPaintOf((p) => ({ ...p, [vehicle]: i }));
  };

  return (
    <div className="stage" ref={stageRef}>
      <canvas ref={canvasRef} className="view" aria-label="A 3D garage with a car and an auto rickshaw" />
      {failed && <p className="fail">This device could not start 3D graphics, so the garage cannot be shown.</p>}

      <div className="hud">
        <div className="top">
          <div className="left">
            <div className="picker" role="group" aria-label="Choose a vehicle">
              {VEHICLES.map((v) => (
                <button key={v.id} type="button" className="pick" aria-pressed={vehicle === v.id} onClick={() => pickVehicle(v.id)}>
                  {v.label}
                </button>
              ))}
            </div>
            <button type="button" className="level-pill" onClick={() => setMenuOpen(true)} aria-label={`Level ${level}, ${progress.done} of ${progress.total} bays parked. Choose a level`}>
              <span className="level-num">Level {level}</span>
              <span className="dots" aria-hidden="true">
                {Array.from({ length: progress.total }, (_, i) => (
                  <i key={i} className={i < progress.done ? 'on' : ''} />
                ))}
              </span>
            </button>
          </div>
          <div className="dash">
            <div className="speed" aria-label={`Speed ${speed} kilometres per hour`}>
              <span className="speed-num">{speed}</span>
              <span className="speed-unit">km/h</span>
            </div>
            <button type="button" className="home" onClick={() => gameRef.current?.reset()} aria-label="Back to the garage">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
            </button>
          </div>
        </div>

        <div className="bottom">
          <div className="paints" role="group" aria-label="Paint colour">
            {PAINTS.map((p, i) => (
              <button
                key={p.hex}
                type="button"
                className="swatch"
                style={{ background: p.hex }}
                aria-label={p.name}
                aria-pressed={paintOf[vehicle] === i}
                onClick={() => pickPaint(i)}
              />
            ))}
          </div>
          <div className="controls">
            <div className="pair">
              <DriveButton label="Turn left" dir="left" held={held.left} onChange={(d) => press('left', d)} />
              <DriveButton label="Turn right" dir="right" held={held.right} onChange={(d) => press('right', d)} />
            </div>
            <div className="pair">
              <DriveButton label="Back" dir="down" held={held.back} onChange={(d) => press('back', d)} />
              <DriveButton label="Go" dir="up" held={held.fwd} onChange={(d) => press('fwd', d)} go />
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}

      {menuOpen && (
        <div className="overlay" onClick={() => setMenuOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Choose a level" onClick={(e) => e.stopPropagation()}>
            <h2>Choose a level</h2>
            <ul className="levels">
              {LEVELS.map((l) => {
                const locked = l.id > unlocked;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      key={shake?.id === l.id ? shake.n : 0}
                      className={'card' + (l.id === level ? ' current' : '') + (locked ? ' locked' : '') + (shake?.id === l.id ? ' wiggle' : '')}
                      aria-disabled={locked}
                      onClick={() => tapLevel(l.id)}
                    >
                      <span className="badge" aria-hidden="true">
                        {locked ? (
                          <svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z" /></svg>
                        ) : l.id}
                      </span>
                      <span className="info">
                        <strong>{l.name}</strong>
                        <small>{locked ? `Finish level ${l.id - 1} to unlock` : l.goal}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="plain" onClick={() => setMenuOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {finished && (
        <div className="overlay celebrate">
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 28 }, (_, i) => (
              <i key={i} style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 7) * 0.12}s` }} />
            ))}
          </div>
          <div className="sheet win" role="dialog" aria-modal="true" aria-label="Level complete">
            <div className="stars" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <svg key={i} viewBox="0 0 24 24" style={{ animationDelay: `${0.15 + i * 0.18}s` }}>
                  <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.3 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
                </svg>
              ))}
            </div>
            <h2>Level {finished.level} complete!</h2>
            {finished.level < LEVELS.length ? (
              <p>{finished.fresh ? `Level ${finished.level + 1}: ${LEVELS[finished.level].name} is unlocked!` : 'Great parking again!'}</p>
            ) : (
              <p>You finished every level. You are a super driver!</p>
            )}
            <div className="actions">
              {finished.level < LEVELS.length ? (
                <button type="button" className="primary" onClick={() => startLevel(finished.level + 1)}>Next level</button>
              ) : (
                <button type="button" className="primary" onClick={() => startLevel(1)}>Play again</button>
              )}
              <button type="button" className="plain" onClick={() => setFinished(null)}>Keep driving</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
