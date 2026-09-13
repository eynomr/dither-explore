"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ParticleCanvas, {
  type ParticleCanvasHandle,
} from "@/components/particle-canvas";
import type { SceneId } from "@/lib/particle-shapes";

const scenes: {
  id: SceneId;
  name: string;
  subtitle: string;
  description: string;
}[] = [
  {
    id: "train",
    name: "The locomotive",
    subtitle: "A little forward momentum.",
    description: "A study in movement, even when standing still.",
  },
  {
    id: "railroad",
    name: "The railroad",
    subtitle: "Every journey starts here.",
    description: "Parallel lines. Infinite destinations.",
  },
  {
    id: "journey",
    name: "The journey",
    subtitle: "Somewhere new awaits.",
    description: "A locomotive, a railroad, and the possibility of elsewhere.",
  },
  {
    id: "factory",
    name: "The factory",
    subtitle: "Where ideas take shape.",
    description: "Small parts come together to make something bigger.",
  },
  {
    id: "human",
    name: "The human",
    subtitle: "Perfectly imperfect.",
    description: "A familiar form, made of a thousand little differences.",
  },
  {
    id: "ai",
    name: "The intelligence",
    subtitle: "A different kind of thinking.",
    description: "An artificial mind. An ever-expanding constellation.",
  },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    arrow: <path d="M7 17 17 7M7 7h10v10" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    download: <path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4" />,
    play: <path d="m9 5 10 7-10 7Z" fill="currentColor" strokeWidth="0" />,
    pause: <path d="M8 5v14M16 5v14" strokeWidth="3" />,
    reset: <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />,
    expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
    scatter: (
      <path d="m9 9-5-5m11 5 5-5M9 15l-5 5m11-5 5 5M4 8V4h4m8 0h4v4M4 16v4h4m8 0h4v-4" />
    ),
    form: (
      <path d="m4 4 5 5m11-5-5 5M4 20l5-5m11 5-5-5M5 9h4V5m6 0v4h4M5 15h4v4m6 0v-4h4" />
    ),
    sliders: (
      <>
        <path d="M4 7h7m4 0h5M4 17h3m4 0h9" />
        <circle cx="13" cy="7" r="2" />
        <circle cx="9" cy="17" r="2" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    moon: <path d="M20.5 13.5A9 9 0 0 1 10.5 3a9 9 0 1 0 10 10.5Z" />,
    cursor: <path d="m5 3 14 10-7 1-3 7Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    cube: (
      <>
        <path d="m12 3 9 5v8l-9 5-9-5V8Zm0 10 9-5M12 13 3 8m9 5v8M7.5 5.5l9 5" />
      </>
    ),
    flat: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <path d="m4 15 5-5 4 4 3-3 4 4" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.arrow}
    </svg>
  );
}

function Dotmark({ small = false }: { small?: boolean }) {
  return (
    <span className={`dotmark ${small ? "small" : ""}`} aria-hidden="true">
      {Array.from({ length: 25 }, (_, i) => (
        <i
          key={i}
          style={{
            opacity: [0.15, 0.4, 0.65, 0.85, 1][
              Math.min(i % 5, 4 - (i % 5)) +
                Math.min(Math.floor(i / 5), 4 - Math.floor(i / 5))
            ],
          }}
        />
      ))}
    </span>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="range-control">
      <span className="range-label">
        <span>{label}</span>
        <output>{display}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--range-progress": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
      />
      <span className="range-ends">
        <span>
          {label === "Density"
            ? "Sparse"
            : label === "Grain size"
              ? "Fine"
              : "Slow"}
        </span>
        <span>
          {label === "Density"
            ? "Dense"
            : label === "Grain size"
              ? "Coarse"
              : "Fast"}
        </span>
      </span>
    </label>
  );
}

export default function Home() {
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [ditherStyle, setDitherStyle] = useState<"ordered" | "halftone">(
    "ordered",
  );
  const [density, setDensity] = useState(68);
  const [particleSize, setParticleSize] = useState(1.35);
  const [speed, setSpeed] = useState(0.8);
  const [playing, setPlaying] = useState(true);
  const [rotating, setRotating] = useState(true);
  const [dark, setDark] = useState(false);
  const [scattered, setScattered] = useState(false);
  const [cycle, setCycle] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [count, setCount] = useState(0);
  const [toast, setToast] = useState("");
  const canvasRef = useRef<ParticleCanvasHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDialogElement>(null);
  const current = scenes[selected];

  const selectScene = useCallback((index: number) => {
    canvasRef.current?.reform();
    setSelected((index + scenes.length) % scenes.length);
    setScattered(false);
  }, []);

  const replay = useCallback(() => {
    setScattered(false);
    setReplayKey((n) => n + 1);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        (e.target instanceof HTMLElement &&
          (e.target.matches("input, button, select, textarea, a") ||
            e.target.isContentEditable)) ||
        aboutRef.current?.open
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        selectScene(selected + 1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        selectScene(selected - 1);
      }
      if (e.key.toLowerCase() === "r") replay();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, selectScene, replay]);

  useEffect(() => {
    if (!cycle || !playing) return;
    const timer = window.setInterval(
      () => selectScene(selected + 1),
      8500 / speed,
    );
    return () => window.clearInterval(timer);
  }, [cycle, playing, selected, speed, selectScene]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function reset() {
    setDensity(68);
    setParticleSize(1.35);
    setSpeed(0.8);
    setPlaying(true);
    setRotating(true);
    setDark(false);
    setCycle(false);
    setDitherStyle("ordered");
    replay();
    setToast("Back to the original settings.");
  }

  function scatter() {
    if (scattered) canvasRef.current?.reform();
    else canvasRef.current?.scatter();
    setScattered((s) => !s);
    setPlaying(true);
  }

  function changeMode(next: "3d" | "2d") {
    setMode(next);
    setScattered(false);
  }

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch {
      setToast("Fullscreen isn’t available in this browser.");
    }
  }

  async function exportImage() {
    try {
      const exported = await canvasRef.current?.exportPng();
      setToast(
        exported
          ? "Your PNG is ready. Check your downloads."
          : "Image export isn’t available yet. Please try again.",
      );
    } catch {
      setToast("The image couldn’t be exported. Please try again.");
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Dither lab home">
          <Dotmark />
          <span>
            dither<span className="brand-divider">/</span>
            <span className="brand-light">lab</span>
          </span>
          <span className="beta-tag">PLAYGROUND</span>
        </Link>
        <nav aria-label="Main navigation">
          <a className="nav-active" href="#playground">
            Explore
          </a>
          <button onClick={() => aboutRef.current?.showModal()}>
            About the experiment <Icon name="arrow" size={14} />
          </button>
        </nav>
        <span className="header-note">
          <i /> A study in small things
        </span>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" /> NO. 001 / PARTICLE EXPLORATIONS
            </div>
            <h1 id="page-title">
              A world, one particle at a time<span>.</span>
            </h1>
            <p>
              A little noise becomes something familiar. Pick a form. Make it
              your own.
            </p>
          </div>
          <a
            className="inspiration-link"
            href="https://dagny-website.vercel.app/homepage"
            target="_blank"
            rel="noreferrer"
          >
            Dither inspiration <Icon name="arrow" size={15} />
          </a>
        </section>

        <section
          id="playground"
          className="workspace"
          aria-label="Interactive particle playground"
        >
          <div className={`stage ${dark ? "stage-dark" : ""}`} ref={stageRef}>
            <div className="stage-header">
              <div className="scene-heading">
                <span className="scene-number">0{selected + 1}</span>
                <div>
                  <h2>{current.name}</h2>
                  <p>{current.description}</p>
                </div>
              </div>
              <div
                className="view-tabs"
                role="tablist"
                aria-label="Canvas dimensions"
              >
                {(["3d", "2d"] as const).map((view) => (
                  <button
                    key={view}
                    id={`view-tab-${view}`}
                    type="button"
                    role="tab"
                    aria-selected={mode === view}
                    aria-controls="view-panel"
                    tabIndex={mode === view ? 0 : -1}
                    onClick={() => changeMode(view)}
                    onKeyDown={(event) => {
                      if (
                        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                          event.key,
                        )
                      )
                        return;
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? "3d"
                          : event.key === "End"
                            ? "2d"
                            : view === "3d"
                              ? "2d"
                              : "3d";
                      changeMode(next);
                      document.getElementById(`view-tab-${next}`)?.focus();
                    }}
                  >
                    <Icon name={view === "3d" ? "cube" : "flat"} size={14} />{" "}
                    {view.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div
              className="canvas-wrap"
              id="view-panel"
              role="tabpanel"
              aria-labelledby={`view-tab-${mode}`}
            >
              <ParticleCanvas
                ref={canvasRef}
                scene={current.id}
                mode={mode}
                ditherStyle={ditherStyle}
                density={density}
                particleSize={particleSize}
                speed={speed}
                playing={playing}
                rotating={rotating && mode === "3d"}
                replayKey={replayKey}
                dark={dark}
                onReady={setCount}
              />
              <span className="crosshair crosshair-tl">+</span>
              <span className="crosshair crosshair-tr">+</span>
              <span className="crosshair crosshair-bl">+</span>
              <span className="crosshair crosshair-br">+</span>
              <div className="canvas-interaction">
                <Icon name="cursor" size={13} />
                <span>
                  {mode === "3d"
                    ? "Move to disturb · Drag to rotate"
                    : "Move to disturb · A study in two dimensions"}
                </span>
              </div>
              <button
                className="icon-button expand-button"
                title="Toggle fullscreen"
                aria-label="Toggle fullscreen"
                onClick={fullscreen}
              >
                <Icon name="expand" size={16} />
              </button>
            </div>
            <div className="stage-footer">
              <div className="playback-controls">
                <button
                  className="icon-button play-button"
                  onClick={() => setPlaying((p) => !p)}
                  title={playing ? "Pause (Space)" : "Play (Space)"}
                  aria-label={playing ? "Pause animation" : "Play animation"}
                >
                  <Icon name={playing ? "pause" : "play"} size={14} />
                </button>
                <button
                  className="icon-button"
                  onClick={replay}
                  title="Reform (R)"
                  aria-label="Replay formation"
                >
                  <Icon name="reset" size={15} />
                </button>
                <span className="playback-divider" />
                <label className="cycle-control">
                  <input
                    type="checkbox"
                    checked={cycle}
                    onChange={(e) => setCycle(e.target.checked)}
                  />
                  <span className="mini-switch" /> Auto sequence
                </label>
              </div>
              <div className="particle-stat">
                <span
                  className={playing ? "status-dot" : "status-dot paused"}
                />{" "}
                {count ? count.toLocaleString("en-US") : "…"} particles{" "}
                <span className="stat-divider">/</span>
                <span>{playing ? "In motion" : "Paused"}</span>
              </div>
            </div>
          </div>

          <aside className="controls" aria-label="Particle controls">
            <div className="controls-title">
              <h2>
                <Icon name="sliders" size={17} /> Make it yours
              </h2>
              <button
                className="text-icon-button"
                title="Reset all settings"
                aria-label="Reset all settings"
                onClick={reset}
              >
                <Icon name="reset" size={15} />
              </button>
            </div>
            <div className="control-section">
              <RangeControl
                label="Density"
                min={20}
                max={100}
                value={density}
                display={`${density}%`}
                onChange={setDensity}
              />
              <RangeControl
                label="Grain size"
                min={0.6}
                max={2.8}
                step={0.05}
                value={particleSize}
                display={`${(particleSize * 2).toFixed(1)} px`}
                onChange={setParticleSize}
              />
              <RangeControl
                label="Motion speed"
                min={0.2}
                max={2}
                step={0.1}
                value={speed}
                display={`${speed.toFixed(1)}×`}
                onChange={setSpeed}
              />
              <label
                className={`toggle-row ${mode === "2d" ? "unavailable" : ""}`}
              >
                <span>
                  {mode === "2d" ? "Rotation · 3D only" : "Gentle rotation"}
                </span>
                <input
                  type="checkbox"
                  checked={rotating && mode === "3d"}
                  disabled={mode === "2d"}
                  onChange={(e) => setRotating(e.target.checked)}
                />
                <span className="switch" />
              </label>
            </div>
            <div className="appearance-section">
              <span className="section-label">DITHER PATTERN</span>
              <div
                className="segmented-control pattern-control"
                role="group"
                aria-label="Dither pattern"
              >
                <button
                  className={ditherStyle === "ordered" ? "selected" : ""}
                  aria-pressed={ditherStyle === "ordered"}
                  onClick={() => setDitherStyle("ordered")}
                >
                  <span
                    className="pattern-swatch pattern-ordered"
                    aria-hidden="true"
                  />
                  Ordered
                </button>
                <button
                  className={ditherStyle === "halftone" ? "selected" : ""}
                  aria-pressed={ditherStyle === "halftone"}
                  onClick={() => setDitherStyle("halftone")}
                >
                  <span
                    className="pattern-swatch pattern-halftone"
                    aria-hidden="true"
                  />
                  Halftone
                </button>
              </div>
              <span className="section-label">APPEARANCE</span>
              <div
                className="segmented-control"
                role="group"
                aria-label="Canvas appearance"
              >
                <button
                  className={!dark ? "selected" : ""}
                  aria-pressed={!dark}
                  onClick={() => setDark(false)}
                >
                  <Icon name="sun" size={14} /> Light
                </button>
                <button
                  className={dark ? "selected" : ""}
                  aria-pressed={dark}
                  onClick={() => setDark(true)}
                >
                  <Icon name="moon" size={14} /> Midnight
                </button>
              </div>
              <div className="color-row">
                <span className="color-swatch" />
                <div>
                  <span>Periwinkle blue</span>
                  <code>oklch(67.5% 0.141 261.3)</code>
                </div>
                <span className="color-lock">01</span>
              </div>
            </div>
            <div className="control-actions">
              <button className="primary-button" onClick={scatter}>
                <Icon name={scattered ? "form" : "scatter"} size={16} />
                {scattered ? "Bring it together" : "Scatter particles"}
              </button>
              <button className="export-button" onClick={exportImage}>
                <Icon name="download" size={15} /> Export image
              </button>
            </div>
          </aside>
        </section>

        <section className="collection" aria-labelledby="collection-title">
          <div className="collection-heading">
            <h2 id="collection-title">
              Six forms. Infinite possibilities.<span>THE COLLECTION</span>
            </h2>
            <div className="collection-nav">
              <span>
                0{selected + 1} <span>/ 06</span>
              </span>
              <button
                className="icon-button previous"
                aria-label="Previous scene"
                onClick={() => selectScene(selected - 1)}
              >
                <Icon name="chevron" size={15} />
              </button>
              <button
                className="icon-button"
                aria-label="Next scene"
                onClick={() => selectScene(selected + 1)}
              >
                <Icon name="chevron" size={15} />
              </button>
            </div>
          </div>
          <div className="scene-grid">
            {scenes.map((scene, i) => (
              <button
                key={scene.id}
                onClick={() => selectScene(i)}
                className={`scene-card ${selected === i ? "is-selected" : ""}`}
                aria-pressed={selected === i}
                aria-label={`Select ${scene.name}`}
              >
                <div className="card-art">
                  <span className="card-number">0{i + 1}</span>
                  <ParticleCanvas
                    scene={scene.id}
                    mode={mode}
                    ditherStyle={ditherStyle}
                    thumbnail
                    interactive={false}
                    playing={false}
                    rotating={false}
                    density={50}
                    particleSize={1.05}
                  />
                  <span className="card-select-indicator">
                    {selected === i ? (
                      <Icon name="check" size={12} />
                    ) : (
                      <Icon name="arrow" size={13} />
                    )}
                  </span>
                </div>
                <div className="card-copy">
                  <h3>{scene.name}</h3>
                  <p>{scene.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <footer className="site-footer">
          <div>
            <Dotmark small />
            <span>Made of particles. Open to possibilities.</span>
          </div>
          <span>
            Move slowly. Look closer.<span className="footer-sparkle">✳</span>
          </span>
        </footer>
      </main>

      <div className={`toast ${toast ? "visible" : ""}`} role="status">
        <Icon name="check" size={16} />
        {toast}
      </div>
      <dialog
        ref={aboutRef}
        className="about-dialog"
        onClick={(e) => {
          if (e.target === aboutRef.current) aboutRef.current.close();
        }}
      >
        <div className="dialog-heading">
          <Dotmark />
          <button
            className="icon-button"
            aria-label="Close about"
            onClick={() => aboutRef.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <span className="eyebrow">AN EXPERIMENT IN FORM</span>
        <h2>
          Everything starts
          <br />
          with a little noise.
        </h2>
        <p>
          Dither / lab is a place to explore how thousands of tiny points can
          become something familiar. Six subjects in 2D and 3D, one blue, and
          room to play. Ordered dither creates tones with a grid of blue pixels;
          halftone builds them with regularly spaced dots.
        </p>
        <p>
          Move your pointer through the canvas to nudge the particles. In 3D,
          drag to see another angle. Scatter them, then watch them find their
          way back.
        </p>
        <div className="keyboard-hints">
          <span>
            <kbd>←</kbd>
            <kbd>→</kbd> Switch form
          </span>
          <span>
            <kbd>Space</kbd> Play / pause
          </span>
          <span>
            <kbd>R</kbd> Reform
          </span>
        </div>
        <a
          href="https://www.inspora.design/posts/dither-cards"
          target="_blank"
          rel="noreferrer"
        >
          Inspired by Dither Cards on Inspora <Icon name="arrow" size={15} />
        </a>
        <a
          href="https://dagny-website.vercel.app/homepage"
          target="_blank"
          rel="noreferrer"
        >
          Dot pattern inspiration from Dagny <Icon name="arrow" size={15} />
        </a>
      </dialog>
    </div>
  );
}
