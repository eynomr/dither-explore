"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  generateShape,
  type ParticlePoint,
  type SceneId,
} from "@/lib/particle-shapes";
import { generateShape2D } from "@/lib/particle-shapes-2d";

export type ParticleCanvasHandle = {
  scatter: () => void;
  reform: () => void;
  exportPng: () => Promise<boolean>;
};

type ParticleCanvasProps = {
  scene: SceneId;
  mode?: "2d" | "3d";
  ditherStyle?: "ordered" | "halftone";
  density?: number;
  particleSize?: number;
  speed?: number;
  dispersion?: number;
  playing?: boolean;
  rotating?: boolean;
  interactive?: boolean;
  thumbnail?: boolean;
  replayKey?: number;
  dark?: boolean;
  onReady?: (count: number) => void;
};

type Options = Required<Omit<ParticleCanvasProps, "onReady">>;
type Engine = ParticleCanvasHandle & { configure: (options: Options) => void };
type Fit = { x: number; y: number; scale: number };

const BLUE = "oklch(67.5% 0.141 261.3)";
const BASE_YAW = -0.45;
const PITCH = 0.22;
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function noise(index: number, salt = 0) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function sceneCamera(scene: SceneId) {
  return scene === "railroad"
    ? { yaw: -0.6, pitch: 0.55 }
    : { yaw: BASE_YAW, pitch: PITCH };
}

function project(x: number, y: number, z: number, yaw: number, pitch: number) {
  const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
  const rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const ry = y * Math.cos(pitch) - rz * Math.sin(pitch);
  return { x: rx, y: -ry, z: rz * Math.cos(pitch) + y * Math.sin(pitch) };
}

/** Canvas owns its animation state so drawing thousands of particles never rerenders React. */
function createEngine(
  canvas: HTMLCanvasElement,
  reportCount: (count: number) => void,
) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return null;
  const ctx = context;
  let options: Options = {
    scene: "train",
    mode: "3d",
    ditherStyle: "ordered",
    density: 65,
    particleSize: 1.5,
    speed: 1,
    dispersion: 0,
    playing: true,
    rotating: true,
    interactive: true,
    thumbnail: false,
    replayKey: 0,
    dark: false,
  };
  let width = 1;
  let height = 1;
  let particles = new Float32Array(0);
  let targets = new Float32Array(0);
  let offsets = new Float32Array(0);
  let pixelRatio = 1;
  let cellSize = 3;
  let fieldCellSize = 3;
  let columns = 0;
  let rows = 0;
  let coverage = new Float32Array(0);
  let ink = new Float32Array(0);
  let weight = new Float32Array(0);
  let depthBuffer = new Float32Array(0);
  let blurCoverage = new Float32Array(0);
  let blurInk = new Float32Array(0);
  let blurWeight = new Float32Array(0);
  let fieldTone = new Float32Array(0);
  let points: ParticlePoint[] = [];
  let count = 0;
  let fit: Fit = { x: 0, y: 0, scale: 1 };
  let targetFit: Fit = { x: 0, y: 0, scale: 1 };
  let scattered = false;
  let visible = true;
  let frame = 0;
  let time = 0;
  let lastTime = 0;
  let manualYaw = 0;
  let autoYaw = 0;
  let dragging = false;
  let capturedPointer: number | null = null;
  let dragX = 0;
  let dragStart = 0;
  let pointer = { x: -10000, y: -10000 };
  let disposed = false;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = media.matches;

  function measureFit() {
    if (!points.length) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const camera = sceneCamera(options.scene);
    for (let i = 0; i < points.length; i += 3) {
      const point = points[i];
      const p =
        options.mode === "2d"
          ? { x: point.x, y: -point.y }
          : project(point.x, point.y, point.z, camera.yaw, camera.pitch);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const margin = options.thumbnail ? 0.85 : 0.81;
    targetFit = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      scale: Math.min(
        (width * margin) / Math.max(0.7, maxX - minX),
        (height * margin) / Math.max(0.8, maxY - minY),
      ),
    };
  }

  function snapToTargets() {
    const spread = scattered ? 1.9 : options.dispersion / 100;
    for (let i = 0; i < count; i++) {
      const k = i * 4;
      particles[k] = targets[k] + offsets[i * 3] * spread;
      particles[k + 1] = targets[k + 1] + offsets[i * 3 + 1] * spread;
      particles[k + 2] = targets[k + 2] + offsets[i * 3 + 2] * spread;
      particles[k + 3] = targets[k + 3];
    }
    fit = { ...targetFit };
  }

  function rebuild(initial: boolean) {
    const nextCount = options.thumbnail
      ? 3600
      : Math.round(8000 + clamp(options.density, 0, 100) * 140);
    points =
      options.mode === "2d"
        ? generateShape2D(options.scene, nextCount)
        : generateShape(options.scene, nextCount);
    const previous = particles;
    const previousCount = count;
    count = points.length;
    particles = new Float32Array(count * 4);
    targets = new Float32Array(count * 4);
    offsets = new Float32Array(count * 3);
    points.forEach((point, index) => {
      const k = index * 4;
      targets[k] = point.x;
      targets[k + 1] = point.y;
      targets[k + 2] = point.z;
      targets[k + 3] = point.brightness;
      offsets[index * 3] = (noise(index, 1) - 0.5) * 3.5;
      offsets[index * 3 + 1] = (noise(index, 2) - 0.5) * 2.5;
      offsets[index * 3 + 2] = (noise(index, 3) - 0.5) * 2.5;
      if (previousCount) {
        const old = (index % previousCount) * 4;
        particles[k] = previous[old];
        particles[k + 1] = previous[old + 1];
        particles[k + 2] = previous[old + 2];
        particles[k + 3] = previous[old + 3];
      } else {
        // Open already recognizable, with a gentle settling of the grain.
        particles[k] = point.x + offsets[index * 3] * 0.15;
        particles[k + 1] = point.y + offsets[index * 3 + 1] * 0.15;
        particles[k + 2] = point.z + offsets[index * 3 + 2] * 0.15;
        particles[k + 3] = point.brightness;
      }
    });
    measureFit();
    if (initial) fit = { ...targetFit };
    if (reducedMotion || options.thumbnail || !options.playing) snapToTargets();
    reportCount(count);
  }

  function prepareLattice() {
    const grain = clamp(options.particleSize, 0.5, 5);
    // Whole device pixels keep the ordered squares crisp at every display scale.
    const requestedSize = options.thumbnail
      ? clamp(grain * 1.04, 1.1, 2.6)
      : grain * 2;
    const nextSize =
      Math.max(1, Math.round(requestedSize * pixelRatio)) / pixelRatio;
    // Reconstruct tone at a fixed screen-space resolution. Grain changes only
    // the final printed lattice, preserving ink density and sampling support.
    const referenceSize = options.thumbnail ? 1.4 : 2.7;
    const nextFieldSize =
      Math.max(1, Math.round(referenceSize * pixelRatio)) / pixelRatio;
    const nextColumns = Math.ceil(width / nextFieldSize);
    const nextRows = Math.ceil(height / nextFieldSize);
    cellSize = nextSize;
    if (
      nextColumns !== columns ||
      nextRows !== rows ||
      nextFieldSize !== fieldCellSize
    ) {
      fieldCellSize = nextFieldSize;
      columns = nextColumns;
      rows = nextRows;
      const length = columns * rows;
      coverage = new Float32Array(length);
      ink = new Float32Array(length);
      weight = new Float32Array(length);
      depthBuffer = new Float32Array(length);
      blurCoverage = new Float32Array(length);
      blurInk = new Float32Array(length);
      blurWeight = new Float32Array(length);
      fieldTone = new Float32Array(length);
    } else {
      coverage.fill(0);
      ink.fill(0);
      weight.fill(0);
    }
    fieldTone.fill(0);
    depthBuffer.fill(-Infinity);
  }

  function splat(
    column: number,
    row: number,
    amount: number,
    tone: number,
    depth: number,
  ) {
    if (
      column < 0 ||
      row < 0 ||
      column >= columns ||
      row >= rows ||
      amount <= 0
    )
      return;
    const index = row * columns + column;
    coverage[index] += amount;
    // Coverage includes the complete silhouette; shading comes from the nearest
    // surface, keeping a boiler, its wheels, and the rails visually separate.
    if (depth > depthBuffer[index] + 0.08) {
      depthBuffer[index] = depth;
      ink[index] = tone * amount;
      weight[index] = amount;
    } else if (depth >= depthBuffer[index] - 0.08) {
      ink[index] += tone * amount;
      weight[index] += amount;
    }
  }

  function renderLattice() {
    // Reconstruct a smooth ink field from the moving samples. A compact tent
    // filter removes sampling noise while preserving small windows and spokes.
    for (let row = 0; row < rows; row++) {
      const start = row * columns;
      for (let column = 0; column < columns; column++) {
        const index = start + column;
        const left = column > 0 ? index - 1 : index;
        const right = column + 1 < columns ? index + 1 : index;
        blurCoverage[index] =
          coverage[left] * 0.25 +
          coverage[index] * 0.5 +
          coverage[right] * 0.25;
        blurInk[index] =
          ink[left] * 0.25 + ink[index] * 0.5 + ink[right] * 0.25;
        blurWeight[index] =
          weight[left] * 0.25 + weight[index] * 0.5 + weight[right] * 0.25;
      }
    }

    const densityGain = 0.58 + clamp(options.density, 0, 100) * 0.0065;
    for (let row = 0; row < rows; row++) {
      const start = row * columns;
      for (let column = 0; column < columns; column++) {
        const index = start + column;
        const above = row > 0 ? index - columns : index;
        const below = row + 1 < rows ? index + columns : index;
        const totalCoverage =
          blurCoverage[above] * 0.25 +
          blurCoverage[index] * 0.5 +
          blurCoverage[below] * 0.25;
        if (totalCoverage < 0.015) continue;
        const totalWeight =
          blurWeight[above] * 0.25 +
          blurWeight[index] * 0.5 +
          blurWeight[below] * 0.25;
        if (totalWeight < 0.0001) continue;
        const totalInk =
          blurInk[above] * 0.25 + blurInk[index] * 0.5 + blurInk[below] * 0.25;
        fieldTone[index] = clamp(
          (totalInk / totalWeight) *
            Math.min(1, totalCoverage * 1.9) *
            densityGain,
          0,
          0.98,
        );
      }
    }

    const outputColumns = Math.ceil(width / cellSize);
    const outputRows = Math.ceil(height / cellSize);
    ctx.fillStyle = BLUE;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (let row = 0; row < outputRows; row++) {
      const fieldY = clamp(
        ((row + 0.5) * cellSize) / fieldCellSize - 0.5,
        0,
        rows - 1,
      );
      const top = Math.floor(fieldY);
      const bottom = Math.min(top + 1, rows - 1);
      const fy = fieldY - top;
      for (let column = 0; column < outputColumns; column++) {
        const fieldX = clamp(
          ((column + 0.5) * cellSize) / fieldCellSize - 0.5,
          0,
          columns - 1,
        );
        const left = Math.floor(fieldX);
        const right = Math.min(left + 1, columns - 1);
        const fx = fieldX - left;
        const topTone =
          fieldTone[top * columns + left] * (1 - fx) +
          fieldTone[top * columns + right] * fx;
        const bottomTone =
          fieldTone[bottom * columns + left] * (1 - fx) +
          fieldTone[bottom * columns + right] * fx;
        const tone = topTone * (1 - fy) + bottomTone * fy;
        if (tone < 0.015) continue;
        const x = column * cellSize;
        const y = row * cellSize;
        if (options.ditherStyle === "ordered") {
          const threshold = (BAYER_4[(row & 3) * 4 + (column & 3)] + 0.5) / 16;
          if (tone > threshold) ctx.rect(x, y, cellSize, cellSize);
        } else if (tone > 0.025) {
          const radius = cellSize * Math.sqrt(tone) * 0.58;
          const centerX = x + cellSize / 2;
          const centerY = y + cellSize / 2;
          ctx.moveTo(centerX + radius, centerY);
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        }
      }
    }
    ctx.fill();
  }

  function draw(timestamp: number, advance: boolean) {
    if (disposed) return;
    const dt = Math.min((timestamp - (lastTime || timestamp)) / 1000, 0.05);
    lastTime = timestamp;
    if (advance && options.rotating && options.mode === "3d")
      time += dt * options.speed;
    ctx.globalAlpha = 1;
    ctx.fillStyle = options.dark ? "#101722" : "#f5f7fb";
    ctx.fillRect(0, 0, width, height);
    if (!count) return;
    prepareLattice();

    const follow = advance
      ? 1 - Math.exp(-dt * 4.8 * Math.max(0.2, options.speed))
      : 0;
    if (advance) {
      fit.x += (targetFit.x - fit.x) * follow;
      fit.y += (targetFit.y - fit.y) * follow;
      fit.scale += (targetFit.scale - fit.scale) * follow;
    }
    if (
      advance &&
      options.rotating &&
      options.mode === "3d" &&
      !options.thumbnail &&
      !reducedMotion
    )
      autoYaw = Math.sin(time * 0.2) * 0.11;
    const camera = sceneCamera(options.scene);
    const yaw = options.mode === "2d" ? 0 : camera.yaw + manualYaw + autoYaw;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = options.mode === "2d" ? 1 : Math.cos(camera.pitch);
    const sp = options.mode === "2d" ? 0 : Math.sin(camera.pitch);
    const spread = scattered ? 1.9 : clamp(options.dispersion, 0, 100) / 100;
    const interaction =
      options.interactive &&
      options.playing &&
      !options.thumbnail &&
      !reducedMotion &&
      !dragging;
    const radius = Math.min(width, height) * 0.15;
    const radiusSquared = radius * radius;

    for (let i = 0; i < count; i++) {
      const k = i * 4;
      if (advance) {
        particles[k] +=
          (targets[k] + offsets[i * 3] * spread - particles[k]) * follow;
        particles[k + 1] +=
          (targets[k + 1] + offsets[i * 3 + 1] * spread - particles[k + 1]) *
          follow;
        particles[k + 2] +=
          (targets[k + 2] + offsets[i * 3 + 2] * spread - particles[k + 2]) *
          follow;
        particles[k + 3] += (targets[k + 3] - particles[k + 3]) * follow;
      }
      const x = particles[k];
      const y = particles[k + 1];
      const z = particles[k + 2];
      const rx = x * cy + z * sy;
      const rz = -x * sy + z * cy;
      const ry = -(y * cp - rz * sp);
      const depth = options.mode === "2d" ? 0 : rz * cp + y * sp;
      let screenX = (rx - fit.x) * fit.scale + width / 2;
      let screenY = (ry - fit.y) * fit.scale + height / 2;
      if (interaction) {
        const dx = screenX - pointer.x;
        const dy = screenY - pointer.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < radiusSquared && distanceSquared > 0.01) {
          const distance = Math.sqrt(distanceSquared);
          const strength = (1 - distance / radius) ** 2 * 27;
          screenX += (dx / distance) * strength;
          screenY += (dy / distance) * strength;
        }
      }
      const tone =
        options.mode === "2d"
          ? clamp(particles[k + 3], 0, 1)
          : clamp(particles[k + 3] * 1.2 + 0.08 + depth * 0.035, 0.08, 1);
      const gridX = screenX / fieldCellSize - 0.5;
      const gridY = screenY / fieldCellSize - 0.5;
      const column = Math.floor(gridX);
      const row = Math.floor(gridY);
      const fx = gridX - column;
      const fy = gridY - row;
      splat(column, row, (1 - fx) * (1 - fy), tone, depth);
      splat(column + 1, row, fx * (1 - fy), tone, depth);
      splat(column, row + 1, (1 - fx) * fy, tone, depth);
      splat(column + 1, row + 1, fx * fy, tone, depth);
    }
    renderLattice();
  }

  function shouldAnimate() {
    return (
      visible &&
      !document.hidden &&
      options.playing &&
      !options.thumbnail &&
      !reducedMotion
    );
  }

  function tick(timestamp: number) {
    frame = 0;
    draw(timestamp, true);
    if (shouldAnimate() && !disposed) frame = requestAnimationFrame(tick);
  }

  function refresh() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (visible) draw(performance.now(), false);
    if (shouldAnimate() && !disposed) frame = requestAnimationFrame(tick);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    measureFit();
    fit = { ...targetFit };
    refresh();
  }

  function onPointerDown(event: PointerEvent) {
    if (
      !options.interactive ||
      !options.playing ||
      options.thumbnail ||
      reducedMotion ||
      event.button !== 0 ||
      dragging
    )
      return;
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (options.mode === "2d") return;
    dragging = true;
    dragX = event.clientX;
    dragStart = manualYaw;
    canvas.setPointerCapture(event.pointerId);
    capturedPointer = event.pointerId;
    canvas.style.cursor = "grabbing";
  }

  function onPointerMove(event: PointerEvent) {
    if (
      !options.interactive ||
      !options.playing ||
      options.thumbnail ||
      reducedMotion
    )
      return;
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (dragging) manualYaw = dragStart + (event.clientX - dragX) * 0.005;
  }

  function onPointerUp(event: PointerEvent) {
    if (capturedPointer !== event.pointerId) return;
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    capturedPointer = null;
    canvas.style.cursor =
      options.interactive && options.playing
        ? options.mode === "2d"
          ? "crosshair"
          : "grab"
        : "default";
  }

  function clearInteraction() {
    dragging = false;
    pointer = { x: -10000, y: -10000 };
    if (capturedPointer !== null && canvas.hasPointerCapture(capturedPointer))
      canvas.releasePointerCapture(capturedPointer);
    capturedPointer = null;
  }

  function onPointerLeave() {
    pointer = { x: -10000, y: -10000 };
  }

  function onMotionChange(event: MediaQueryListEvent) {
    reducedMotion = event.matches;
    if (reducedMotion) {
      clearInteraction();
      snapToTargets();
    }
    refresh();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    refresh();
  });
  intersectionObserver.observe(canvas);
  media.addEventListener("change", onMotionChange);
  document.addEventListener("visibilitychange", refresh);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  resize();

  const engine: Engine = {
    configure(next) {
      const rebuildShape =
        next.scene !== options.scene ||
        next.mode !== options.mode ||
        next.density !== options.density ||
        next.thumbnail !== options.thumbnail ||
        count === 0;
      const replay = next.replayKey !== options.replayKey;
      const dispersionChanged = next.dispersion !== options.dispersion;
      const sceneChanged =
        next.scene !== options.scene || next.mode !== options.mode;
      options = next;
      if (sceneChanged) {
        scattered = false;
        manualYaw = 0;
        autoYaw = 0;
        time = 0;
        clearInteraction();
      }
      if (rebuildShape) rebuild(count === 0);
      if (replay) {
        scattered = false;
        manualYaw = 0;
        autoYaw = 0;
        time = 0;
        clearInteraction();
        for (let i = 0; i < count; i++) {
          particles[i * 4] += offsets[i * 3] * 1.8;
          particles[i * 4 + 1] += offsets[i * 3 + 1] * 1.8;
          particles[i * 4 + 2] += offsets[i * 3 + 2] * 1.8;
        }
      }
      if (
        (dispersionChanged || replay) &&
        (!options.playing || reducedMotion || options.thumbnail)
      )
        snapToTargets();
      if (!options.playing || !options.interactive || options.thumbnail)
        clearInteraction();
      canvas.style.cursor =
        options.interactive && options.playing && !options.thumbnail
          ? options.mode === "2d"
            ? "crosshair"
            : "grab"
          : "default";
      refresh();
    },
    scatter() {
      scattered = true;
      if (!options.playing || reducedMotion || options.thumbnail)
        snapToTargets();
      refresh();
    },
    reform() {
      scattered = false;
      if (!options.playing || reducedMotion || options.thumbnail)
        snapToTargets();
      refresh();
    },
    async exportPng() {
      if (disposed || !count || width <= 1 || height <= 1) return false;
      try {
        draw(performance.now(), false);
        const scene = options.scene;
        const mode = options.mode;
        const style = options.ditherStyle;
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!blob) return false;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `dither-${scene}-${mode}-${style}.png`;
        link.href = url;
        link.style.display = "none";
        document.body.appendChild(link);
        try {
          link.click();
        } finally {
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        }
        return true;
      } catch {
        return false;
      }
    },
  };

  return {
    engine,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      media.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", refresh);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    },
  };
}

const ParticleCanvas = forwardRef<ParticleCanvasHandle, ParticleCanvasProps>(
  function ParticleCanvas(
    {
      scene,
      mode = "3d",
      ditherStyle = "ordered",
      density = 65,
      particleSize = 1.5,
      speed = 1,
      dispersion = 0,
      playing = true,
      rotating = true,
      interactive = true,
      thumbnail = false,
      replayKey = 0,
      dark = false,
      onReady,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);
    const onReadyRef = useRef(onReady);

    useEffect(() => {
      onReadyRef.current = onReady;
    }, [onReady]);

    useImperativeHandle(
      ref,
      () => ({
        scatter: () => engineRef.current?.scatter(),
        reform: () => engineRef.current?.reform(),
        exportPng: () =>
          engineRef.current?.exportPng() ?? Promise.resolve(false),
      }),
      [],
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const instance = createEngine(canvas, (count) =>
        onReadyRef.current?.(count),
      );
      if (!instance) return;
      engineRef.current = instance.engine;
      return () => {
        instance.dispose();
        engineRef.current = null;
      };
    }, []);

    useEffect(() => {
      engineRef.current?.configure({
        scene,
        mode,
        ditherStyle,
        density,
        particleSize,
        speed,
        dispersion,
        playing,
        rotating,
        interactive,
        thumbnail,
        replayKey,
        dark,
      });
    }, [
      scene,
      mode,
      ditherStyle,
      density,
      particleSize,
      speed,
      dispersion,
      playing,
      rotating,
      interactive,
      thumbnail,
      replayKey,
      dark,
    ]);

    return (
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${scene === "journey" ? "Train on a railroad" : scene === "ai" ? "Artificial intelligence" : scene} in ${mode === "2d" ? "two" : "three"} dimensions, rendered with blue ${ditherStyle === "ordered" ? "ordered dither" : "halftone"} particles`}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          touchAction: interactive && !thumbnail ? "none" : "auto",
        }}
      />
    );
  },
);

export default ParticleCanvas;
