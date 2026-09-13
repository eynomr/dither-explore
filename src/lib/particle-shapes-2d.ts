import type { ParticlePoint, SceneId } from "./particle-shapes";

// These are tonal illustrations, before dithering. White is empty paper; darker
// values mean more ink. The renderer turns those tones into a fixed pixel grid.
const WIDTH = 960;
const HEIGHT = 640;
const TAU = Math.PI * 2;
type Ink = string | CanvasGradient;
type Context = CanvasRenderingContext2D;
const rasters = new Map<SceneId, Uint8ClampedArray>();

function path(ctx: Context, definition: string, ink: Ink) {
  ctx.fillStyle = ink;
  ctx.fill(new Path2D(definition));
}

function line(ctx: Context, definition: string, ink: Ink, width = 4) {
  ctx.strokeStyle = ink;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(definition));
}

function rect(
  ctx: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  ink: Ink,
) {
  ctx.fillStyle = ink;
  ctx.fillRect(x, y, w, h);
}

function ellipse(
  ctx: Context,
  x: number,
  y: number,
  rx: number,
  ry: number,
  ink: Ink,
) {
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function gradient(
  ctx: Context,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  shades: number[],
) {
  const fill = ctx.createLinearGradient(x1, y1, x2, y2);
  shades.forEach((shade, i) =>
    fill.addColorStop(
      i / (shades.length - 1),
      `rgb(${shade},${shade},${shade})`,
    ),
  );
  return fill;
}

function smoke(ctx: Context, x: number, y: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  path(
    ctx,
    "M 14 36 C -8 23 -23 32 -23 8 C -57 24 -78 7 -69 -17 C -100 -2 -141 -6 -134 -30 C -170 -7 -205 -20 -210 -41 C -187 -60 -156 -64 -139 -48 C -125 -80 -88 -76 -78 -51 C -49 -69 -17 -44 -25 -24 C 8 -28 30 -8 14 36 Z",
    gradient(ctx, -180, -75, 15, 30, [239, 211, 170]),
  );
  ctx.restore();
}

function wheel(ctx: Context, x: number, y: number, radius: number) {
  ellipse(ctx, x, y, radius, radius, "#252525");
  ellipse(ctx, x, y, radius - 5, radius - 5, "#dedede");
  ellipse(
    ctx,
    x,
    y,
    radius - 10,
    radius - 10,
    gradient(ctx, x - radius, y - radius, x + radius, y + radius, [249, 181]),
  );
  for (let spoke = 0; spoke < 10; spoke++) {
    const angle = (spoke / 10) * TAU;
    line(
      ctx,
      `M ${x} ${y} L ${x + Math.cos(angle) * (radius - 8)} ${y + Math.sin(angle) * (radius - 8)}`,
      "#464646",
      4,
    );
  }
  ellipse(ctx, x, y, radius * 0.2, radius * 0.2, "#353535");
  ellipse(ctx, x - 1, y - 2, radius * 0.08, radius * 0.08, "#ededed");
}

function locomotive(ctx: Context) {
  smoke(ctx, 724, 181, 0.92);
  // Tender, coal, footplate and cab.
  path(
    ctx,
    "M 93 335 L 101 304 L 114 314 L 128 291 L 147 305 L 162 292 L 179 309 L 193 298 L 221 334 Z",
    "#777777",
  );
  rect(ctx, 89, 334, 155, 84, gradient(ctx, 89, 330, 89, 426, [124, 189, 83]));
  rect(ctx, 79, 327, 174, 11, "#393939");
  rect(ctx, 102, 346, 127, 7, "#d9d9d9");
  rect(ctx, 109, 361, 107, 40, "#9d9d9d");
  line(ctx, "M 246 419 L 286 419", "#333333", 10);
  rect(
    ctx,
    281,
    240,
    150,
    181,
    gradient(ctx, 285, 240, 425, 420, [124, 198, 78]),
  );
  path(
    ctx,
    "M 263 239 Q 271 225 286 226 L 435 226 L 447 244 L 263 244 Z",
    "#383838",
  );
  rect(ctx, 297, 256, 112, 82, "#424242");
  rect(ctx, 304, 262, 44, 65, "#ffffff");
  rect(ctx, 356, 262, 44, 65, "#ffffff");
  rect(ctx, 298, 331, 110, 6, "#dedede");
  rect(ctx, 299, 361, 45, 39, "#949494");
  rect(ctx, 282, 412, 534, 22, "#4c4c4c");
  rect(ctx, 280, 409, 541, 5, "#d7d7d7");
  // Cylindrical boiler, bands, domes, funnel and front lamp.
  path(
    ctx,
    "M 423 303 L 745 303 Q 770 345 745 399 L 422 399 Z",
    gradient(ctx, 0, 301, 0, 400, [109, 215, 178, 67]),
  );
  ellipse(ctx, 746, 351, 22, 49, "#747474");
  ellipse(ctx, 750, 351, 14, 39, gradient(ctx, 738, 320, 765, 383, [150, 56]));
  for (const x of [464, 574, 680]) {
    rect(ctx, x, 303, 7, 95, "#555555");
    rect(ctx, x + 7, 305, 3, 91, "#e7e7e7");
  }
  path(
    ctx,
    "M 494 303 L 495 279 Q 502 259 521 260 Q 540 260 546 279 L 547 303 Z",
    gradient(ctx, 494, 0, 548, 0, [99, 187, 94]),
  );
  rect(ctx, 489, 299, 63, 7, "#525252");
  path(
    ctx,
    "M 595 302 L 595 289 L 588 287 Q 589 270 604 268 Q 620 270 621 287 L 614 289 L 614 303 Z",
    "#777777",
  );
  path(
    ctx,
    "M 695 303 L 697 218 L 687 199 L 751 199 L 741 219 L 744 303 Z",
    gradient(ctx, 690, 0, 748, 0, [75, 175, 72]),
  );
  rect(ctx, 683, 193, 73, 10, "#3c3c3c");
  rect(ctx, 704, 220, 6, 72, "#d5d5d5");
  line(ctx, "M 435 317 L 674 317", "#efefef", 4);
  line(ctx, "M 429 319 L 429 352", "#454545", 4);
  ellipse(ctx, 781, 315, 18, 18, "#555555");
  ellipse(ctx, 786, 313, 11, 11, "#e2e2e2");
  line(ctx, "M 769 329 L 769 356", "#454545", 7);
  // Exposed wheels and the recognizable connecting rod.
  wheel(ctx, 128, 437, 28);
  wheel(ctx, 209, 437, 28);
  wheel(ctx, 387, 437, 45);
  wheel(ctx, 497, 437, 45);
  wheel(ctx, 607, 437, 45);
  wheel(ctx, 754, 451, 30);
  line(ctx, "M 370 448 L 593 448 L 638 422 L 689 422", "#343434", 12);
  line(ctx, "M 370 445 L 593 445 L 638 419 L 689 419", "#cfcfcf", 5);
  for (const x of [387, 497, 607]) ellipse(ctx, x, 446, 5, 5, "#484848");
  path(ctx, "M 804 421 L 855 473 L 789 473 Z", "#a1a1a1");
  for (let i = 0; i < 5; i++)
    line(ctx, `M ${802 + i * 3} 427 L ${797 + i * 11} 467`, "#3e3e3e", 3);
  line(ctx, "M 787 474 L 858 474", "#353535", 6);
  line(ctx, "M 286 398 L 273 441 L 301 441", "#494949", 5);
}

function railroad(ctx: Context) {
  // A low vanishing point and increasingly broad sleepers give a quiet, graphic
  // depth cue without using any 3D coordinates or a camera orbit.
  path(
    ctx,
    "M 444 142 L 516 142 L 878 561 L 82 561 Z",
    gradient(ctx, 0, 142, 0, 561, [247, 239, 224]),
  );
  for (let tie = 0; tie < 23; tie++) {
    const t = (tie + 1) / 23;
    const p = Math.pow(t, 1.65);
    const y = 143 + p * 407;
    const half = 20 + p * 331;
    const height = 2 + p * 17;
    path(
      ctx,
      `M ${480 - half} ${y} L ${480 + half} ${y} L ${486 + half + height} ${y + height} L ${474 - half - height} ${y + height} Z`,
      gradient(ctx, 0, y, 0, y + height, [119, 186, 109]),
    );
    if (tie > 9)
      line(
        ctx,
        `M ${492 - half} ${y + height * 0.3} L ${466 + half} ${y + height * 0.3}`,
        "#e3e3e3",
        1.5,
      );
  }
  path(ctx, "M 451 143 L 457 143 L 287 563 L 257 563 Z", "#595959");
  path(ctx, "M 503 143 L 509 143 L 703 563 L 673 563 Z", "#595959");
  path(ctx, "M 451 143 L 454 143 L 273 558 L 259 558 Z", "#c8c8c8");
  path(ctx, "M 503 143 L 506 143 L 689 558 L 675 558 Z", "#d4d4d4");
  line(ctx, "M 450 144 L 249 563", "#878787", 2);
  line(ctx, "M 511 144 L 713 563", "#878787", 2);
  for (let tie = 6; tie < 23; tie++) {
    const p = Math.pow((tie + 1) / 23, 1.65);
    const y = 143 + p * 407;
    const distance = 26 + p * 176;
    const radius = 1 + p * 3;
    for (const side of [-1, 1])
      ellipse(
        ctx,
        480 + side * distance,
        y + 2,
        radius,
        radius * 0.7,
        "#353535",
      );
  }
  line(ctx, "M 165 343 L 165 427", "#757575", 5);
  rect(ctx, 151, 336, 28, 28, "#ababab");
  line(ctx, "M 787 374 L 787 470", "#757575", 5);
  rect(ctx, 773, 366, 28, 30, "#ababab");
}

function journey(ctx: Context) {
  // The same engine in a wide, side-on railway vignette.
  ctx.save();
  ctx.translate(47, 23);
  ctx.scale(0.9, 0.9);
  locomotive(ctx);
  ctx.restore();
  for (let tie = 0; tie < 32; tie++) {
    const x = 82 + tie * 25;
    path(
      ctx,
      `M ${x} 465 L ${x + 17} 465 L ${x + 1} 496 L ${x - 16} 496 Z`,
      "#a2a2a2",
    );
  }
  rect(ctx, 64, 462, 832, 7, "#555555");
  rect(ctx, 64, 483, 832, 7, "#777777");
  rect(ctx, 64, 461, 832, 2, "#d8d8d8");
  path(
    ctx,
    "M 61 503 Q 214 483 333 505 Q 421 513 513 502 Q 679 487 899 502 L 899 518 L 61 518 Z",
    "#e5e5e5",
  );
}

function factory(ctx: Context) {
  smoke(ctx, 354, 113, 0.64);
  smoke(ctx, 528, 143, 0.51);
  smoke(ctx, 720, 174, 0.4);
  for (const [x, top, bottom] of [
    [334, 134, 379],
    [513, 161, 388],
    [707, 187, 394],
  ]) {
    path(
      ctx,
      `M ${x - 16} ${top} L ${x + 16} ${top} L ${x + 25} ${bottom} L ${x - 25} ${bottom} Z`,
      gradient(ctx, x - 25, 0, x + 25, 0, [100, 181, 87]),
    );
    rect(ctx, x - 21, top - 7, 42, 13, "#5d5d5d");
    for (let y = top + 30; y < bottom; y += 24)
      line(ctx, `M ${x - 18} ${y} L ${x + 18} ${y}`, "#9c9c9c", 2);
  }
  path(
    ctx,
    "M 121 344 L 279 254 L 279 344 L 441 254 L 441 344 L 603 254 L 603 344 L 765 254 L 765 510 L 121 510 Z",
    gradient(ctx, 0, 270, 0, 515, [151, 193, 115]),
  );
  for (const x of [121, 283, 445, 607]) {
    path(ctx, `M ${x + 17} 336 L ${x + 145} 264 L ${x + 145} 337 Z`, "#e7e7e7");
    for (let pane = 1; pane < 5; pane++) {
      const px = x + 17 + pane * 25;
      const py = 336 - pane * 14;
      line(ctx, `M ${px} ${py} L ${px} 338`, "#919191", 3);
    }
    line(ctx, `M ${x} 344 L ${x + 158} 254 L ${x + 158} 344`, "#4f4f4f", 5);
  }
  rect(ctx, 119, 343, 650, 10, "#696969");
  rect(ctx, 120, 356, 648, 4, "#dfdfdf");
  for (let column = 0; column < 8; column++) {
    const x = 144 + column * 76;
    rect(ctx, x, 380, 48, 82, "#666666");
    rect(ctx, x + 4, 384, 40, 71, "#efefef");
    rect(ctx, x + 22, 383, 4, 76, "#868686");
    rect(ctx, x + 3, 406, 43, 4, "#868686");
    rect(ctx, x + 3, 432, 43, 4, "#868686");
    rect(ctx, x - 3, 461, 54, 5, "#717171");
  }
  rect(ctx, 113, 505, 667, 12, "#737373");
  rect(ctx, 760, 400, 106, 110, gradient(ctx, 760, 400, 860, 510, [179, 107]));
  path(ctx, "M 753 399 L 824 374 L 875 396 L 875 406 L 753 406 Z", "#6b6b6b");
  rect(ctx, 790, 423, 53, 81, "#646464");
  for (let row = 0; row < 8; row++)
    rect(ctx, 794, 428 + row * 9, 44, 4, "#acacac");
  line(ctx, "M 91 508 L 91 367 L 107 367 L 107 507", "#777777", 5);
  for (let y = 380; y < 505; y += 16)
    line(ctx, `M 91 ${y} L 107 ${y}`, "#777777", 3);
}

function human(ctx: Context) {
  // A profile bust with sculptural light, a clear face contour and quiet hatching
  // in the hair. Keeping the facial features in silhouette survives coarse pixels.
  const bust =
    "M 229 537 C 235 478 284 449 355 424 C 402 406 422 382 427 342 C 392 321 374 287 370 244 C 359 204 365 147 403 113 C 438 80 502 76 546 98 C 586 118 604 151 606 182 C 608 204 596 213 604 229 L 634 272 Q 639 281 625 286 L 606 287 L 607 303 L 614 311 Q 615 317 601 325 C 610 340 599 359 582 364 L 542 366 C 536 392 546 416 569 430 C 649 451 706 477 723 537 Z";
  const shape = new Path2D(bust);
  ctx.save();
  ctx.clip(shape);
  rect(
    ctx,
    210,
    70,
    530,
    480,
    gradient(ctx, 343, 170, 637, 329, [79, 179, 224, 160]),
  );
  path(
    ctx,
    "M 233 536 Q 251 475 357 429 Q 405 421 427 362 L 471 384 Q 468 422 447 450 L 420 537 Z",
    gradient(ctx, 264, 443, 459, 470, [106, 182, 216]),
  );
  path(
    ctx,
    "M 461 345 Q 502 362 542 366 Q 531 402 551 419 L 478 447 Q 493 396 461 345 Z",
    "#aaaaaa",
  );
  path(ctx, "M 443 428 L 485 448 L 460 537 L 411 537 Z", "#dedede");
  path(
    ctx,
    "M 503 453 Q 565 438 626 463 Q 675 484 699 537 L 521 537 Z",
    gradient(ctx, 510, 440, 667, 549, [218, 148]),
  );
  path(
    ctx,
    "M 367 248 Q 342 158 386 112 Q 460 51 541 94 Q 586 108 605 166 Q 574 175 548 157 Q 527 170 501 164 Q 482 199 453 210 L 438 274 L 412 303 Z",
    gradient(ctx, 380, 89, 539, 258, [48, 105, 143]),
  );
  for (let strand = 0; strand < 8; strand++) {
    const shift = strand * 10;
    line(
      ctx,
      `M ${384 + shift * 0.4} ${197 - shift * 0.6} Q ${412 + shift * 0.8} ${77 + shift * 0.3} ${543 + shift * 0.4} ${115 + shift * 0.6}`,
      "#a6a6a6",
      3,
    );
  }
  ellipse(ctx, 441, 260, 24, 35, gradient(ctx, 419, 245, 465, 272, [170, 216]));
  line(
    ctx,
    "M 443 280 Q 425 257 439 243 Q 454 237 454 258 L 444 263",
    "#8b8b8b",
    4,
  );
  path(
    ctx,
    "M 560 215 Q 585 201 601 215 L 597 224 Q 578 216 560 224 Z",
    "#696969",
  );
  line(ctx, "M 565 236 Q 579 243 590 235", "#777777", 4);
  ellipse(ctx, 585, 236, 4, 4, "#545454");
  path(
    ctx,
    "M 576 249 Q 568 268 580 279 L 602 280 Q 584 266 597 248 Z",
    "#c2c2c2",
  );
  line(ctx, "M 599 282 Q 607 276 616 280", "#888888", 3);
  line(ctx, "M 583 315 Q 598 309 609 311", "#7a7a7a", 4);
  line(ctx, "M 583 321 Q 594 325 602 322", "#cfcfcf", 4);
  path(
    ctx,
    "M 481 296 Q 502 333 555 339 Q 554 354 538 358 Q 489 346 472 318 Z",
    "#bababa",
  );
  line(ctx, "M 376 445 Q 413 465 442 462", "#939393", 4);
  ctx.restore();
  rect(ctx, 222, 537, 508, 12, "#777777");
  rect(ctx, 262, 553, 428, 8, "#b1b1b1");
}

function intelligence(ctx: Context) {
  // A neural core etched into a chip, with orbital traces linking it to the world.
  ctx.save();
  ctx.translate(480, 322);
  ctx.strokeStyle = "#999999";
  ctx.lineWidth = 3;
  for (const angle of [-0.6, 0.6]) {
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, 301, 161, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  for (let pin = 0; pin < 9; pin++) {
    const location = 355 + pin * 31;
    rect(ctx, location, 129, 13, 51, gradient(ctx, 0, 129, 0, 182, [192, 81]));
    rect(ctx, location, 460, 13, 52, gradient(ctx, 0, 460, 0, 512, [81, 192]));
    rect(
      ctx,
      286,
      195 + pin * 31,
      51,
      13,
      gradient(ctx, 286, 0, 337, 0, [192, 81]),
    );
    rect(
      ctx,
      622,
      195 + pin * 31,
      51,
      13,
      gradient(ctx, 622, 0, 673, 0, [81, 192]),
    );
  }
  rect(ctx, 329, 174, 302, 296, "#777777");
  rect(
    ctx,
    338,
    183,
    284,
    278,
    gradient(ctx, 339, 184, 621, 461, [171, 226, 118]),
  );
  rect(ctx, 358, 203, 244, 238, "#f5f5f5");
  rect(
    ctx,
    365,
    210,
    230,
    224,
    gradient(ctx, 365, 210, 595, 434, [204, 233, 170]),
  );
  const brain =
    "M 476 232 C 460 213 431 221 428 241 C 403 233 386 255 393 275 C 373 284 377 312 391 320 C 376 342 390 365 409 365 C 407 389 430 403 450 393 C 460 413 480 401 480 385 L 480 245 Z M 486 232 C 502 213 531 221 534 241 C 559 233 576 255 569 275 C 589 284 585 312 571 320 C 586 342 572 365 553 365 C 555 389 532 403 512 393 C 502 413 486 401 486 385 L 486 245 Z";
  path(ctx, brain, gradient(ctx, 393, 230, 571, 401, [139, 80, 155]));
  const grooves = [
    "M 454 239 Q 440 252 448 266 L 426 278 Q 412 270 416 255",
    "M 403 285 Q 428 290 429 310 L 450 309 Q 469 289 461 278",
    "M 399 324 Q 413 330 413 347 L 435 350 Q 445 338 438 327",
    "M 428 373 Q 451 378 458 359 L 464 338",
  ];
  for (const definition of grooves) {
    line(ctx, definition, "#ebebeb", 6);
    ctx.save();
    ctx.translate(965, 0);
    ctx.scale(-1, 1);
    line(ctx, definition, "#dedede", 6);
    ctx.restore();
  }
  for (const [x, y] of [
    [348, 192],
    [611, 451],
    [201, 305],
    [759, 340],
    [654, 146],
    [306, 493],
  ]) {
    ellipse(
      ctx,
      x,
      y,
      x < 330 || x > 630 ? 11 : 5,
      x < 330 || x > 630 ? 11 : 5,
      "#5f5f5f",
    );
    ellipse(ctx, x - 2, y - 2, 3, 3, "#d9d9d9");
  }
}

function rasterize(scene: SceneId): Uint8ClampedArray {
  const cached = rasters.get(scene);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  rect(ctx, 0, 0, WIDTH, HEIGHT, "#ffffff");
  const draw: Record<SceneId, (context: Context) => void> = {
    train: locomotive,
    railroad,
    journey,
    factory,
    human,
    ai: intelligence,
  };
  draw[scene](ctx);
  const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
  rasters.set(scene, pixels);
  return pixels;
}

/**
 * Flat, deterministic particle destinations for the 2D tab. Call in the browser.
 * Brightness is ink density (0 = paper, 1 = solid ink), not emitted light.
 * A two-dimensional additive recurrence spreads samples evenly without the
 * clumps of random sampling or the scanlines of row-major raster sampling.
 */
export function generateShape2D(
  scene: SceneId,
  count: number,
): ParticlePoint[] {
  if (!Number.isFinite(count) || count < 1 || typeof document === "undefined")
    return [];
  const size = Math.floor(count);
  const pixels = rasterize(scene);
  const points: ParticlePoint[] = [];
  // Irrational steps from the plastic constant, an R2 low-discrepancy sequence.
  let u = 0.5;
  let v = 0.5;
  const maxAttempts = size * 100 + 1000;
  for (
    let attempt = 0;
    points.length < size && attempt < maxAttempts;
    attempt++
  ) {
    u = (u + 0.7548776662466927) % 1;
    v = (v + 0.5698402909980532) % 1;
    const offset = (Math.floor(v * HEIGHT) * WIDTH + Math.floor(u * WIDTH)) * 4;
    const darkness = (255 - pixels[offset]) / 255;
    if (pixels[offset + 3] === 0 || darkness < 0.035) continue;
    points.push({
      x: (u - 0.5) * 3.4,
      y: (0.5 - v) * ((3.4 * HEIGHT) / WIDTH),
      z: 0,
      brightness: Math.min(1, Math.max(0.06, darkness)),
    });
  }
  return points;
}
