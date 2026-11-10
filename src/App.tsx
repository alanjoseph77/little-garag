import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [held, setHeld] = useState<Record<InputKey, boolean>>({ fwd: false, back: false, left: false, right: false });

  useEffect(() => {
    if (!canvasRef.current || !stageRef.current) return;
    let game: Game;
    try {
      game = createGame(canvasRef.current, stageRef.current, { onSpeed: setSpeed });
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
          <div className="picker" role="group" aria-label="Choose a vehicle">
            {VEHICLES.map((v) => (
              <button key={v.id} type="button" className="pick" aria-pressed={vehicle === v.id} onClick={() => pickVehicle(v.id)}>
                {v.label}
              </button>
            ))}
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
    </div>
  );
}
