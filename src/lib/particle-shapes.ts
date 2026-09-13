/** Procedural, dependency-free surfaces for the particle laboratory. */
export type SceneId =
  | "train"
  | "railroad"
  | "journey"
  | "factory"
  | "human"
  | "ai";

export type ParticlePoint = {
  x: number;
  y: number;
  z: number;
  brightness: number;
};

type Vec3 = [number, number, number];
type Random = () => number;
type Surface = { weight: number; sample: (random: Random) => ParticlePoint };
type SurfaceFilter = (point: Vec3, normal: Vec3) => boolean;

const TAU = Math.PI * 2;
const LIGHT: Vec3 = [-0.36, 0.76, 0.54];

function randomSource(seed: number): Random {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length) as Vec3;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function shaded(
  point: Vec3,
  normal: Vec3,
  brightness: number,
  random: Random,
): ParticlePoint {
  const light = normal.reduce((sum, value, i) => sum + value * LIGHT[i], 0);
  return {
    x: point[0],
    y: point[1],
    z: point[2],
    brightness: Math.min(
      1,
      Math.max(
        0.09,
        brightness *
          (0.64 + Math.max(-0.3, light) * 0.37) *
          (0.77 + random() * 0.38),
      ),
    ),
  };
}

class Sculptor {
  surfaces: Surface[] = [];

  box(
    center: Vec3,
    size: Vec3,
    brightness = 0.85,
    density = 1,
    filter?: SurfaceFilter,
  ) {
    const areas = [size[1] * size[2], size[0] * size[2], size[0] * size[1]];
    const area = areas[0] + areas[1] + areas[2];
    this.surfaces.push({
      weight: area * 2 * density,
      sample(random) {
        let point: Vec3 = [...center];
        let normal: Vec3 = [0, 1, 0];
        for (let attempt = 0; attempt < 24; attempt++) {
          const face = random() * area;
          const axis = face < areas[0] ? 0 : face < areas[0] + areas[1] ? 1 : 2;
          const sign = random() < 0.5 ? -1 : 1;
          point = center.map(
            (value, i) =>
              value + (i === axis ? sign * 0.5 : random() - 0.5) * size[i],
          ) as Vec3;
          normal = [0, 0, 0];
          normal[axis] = sign;
          if (!filter || filter(point, normal)) break;
        }
        return shaded(point, normal, brightness, random);
      },
    });
  }

  ellipsoid(
    center: Vec3,
    radii: Vec3,
    brightness = 0.85,
    density = 1,
    filter?: SurfaceFilter,
  ) {
    const area =
      4 *
      Math.PI *
      ((radii[0] * radii[1] + radii[1] * radii[2] + radii[0] * radii[2]) / 3);
    this.surfaces.push({
      weight: area * density,
      sample(random) {
        let point: Vec3 = [...center];
        let normal: Vec3 = [0, 1, 0];
        for (let attempt = 0; attempt < 24; attempt++) {
          const azimuth = random() * TAU;
          const vertical = random() * 2 - 1;
          const radial = Math.sqrt(1 - vertical * vertical);
          const direction: Vec3 = [
            radial * Math.cos(azimuth),
            vertical,
            radial * Math.sin(azimuth),
          ];
          point = center.map(
            (value, i) => value + direction[i] * radii[i],
          ) as Vec3;
          normal = normalize(
            direction.map((value, i) => value / radii[i]) as Vec3,
          );
          if (!filter || filter(point, normal)) break;
        }
        return shaded(point, normal, brightness, random);
      },
    });
  }

  cylinder(
    a: Vec3,
    b: Vec3,
    radius: number,
    brightness = 0.9,
    density = 1,
    endRadius = radius,
  ) {
    const vector = b.map((value, i) => value - a[i]) as Vec3;
    const length = Math.hypot(...vector);
    const direction = normalize(vector);
    const u = normalize(
      cross(direction, Math.abs(direction[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]),
    );
    const v = cross(direction, u);
    const sideArea = Math.PI * (radius + endRadius) * length;
    const capsArea = Math.PI * (radius * radius + endRadius * endRadius);
    this.surfaces.push({
      weight: (sideArea + capsArea) * density,
      sample(random) {
        const angle = random() * TAU;
        const cap = random() * (sideArea + capsArea) > sideArea;
        const t = cap ? (random() < 0.5 ? 0 : 1) : random();
        const r =
          (radius + (endRadius - radius) * t) * (cap ? Math.sqrt(random()) : 1);
        const radial = u.map(
          (value, i) => value * Math.cos(angle) + v[i] * Math.sin(angle),
        ) as Vec3;
        const point = a.map(
          (value, i) => value + vector[i] * t + radial[i] * r,
        ) as Vec3;
        const normal = cap
          ? (direction.map((value) => value * (t === 0 ? -1 : 1)) as Vec3)
          : radial;
        return shaded(point, normal, brightness, random);
      },
    });
  }

  ring(
    center: Vec3,
    normal: Vec3,
    radius: number,
    thickness: number,
    brightness = 1,
    density = 1,
  ) {
    const axis = normalize(normal);
    const u = normalize(
      cross(axis, Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]),
    );
    const v = cross(axis, u);
    this.surfaces.push({
      weight: TAU * radius * TAU * thickness * density,
      sample(random) {
        const a = random() * TAU;
        const b = random() * TAU;
        const radial = u.map(
          (value, i) => value * Math.cos(a) + v[i] * Math.sin(a),
        ) as Vec3;
        const surfaceNormal = radial.map(
          (value, i) => value * Math.cos(b) + axis[i] * Math.sin(b),
        ) as Vec3;
        const point = center.map(
          (value, i) =>
            value + radial[i] * radius + surfaceNormal[i] * thickness,
        ) as Vec3;
        return shaded(point, surfaceNormal, brightness, random);
      },
    });
  }

  triangle(a: Vec3, b: Vec3, c: Vec3, brightness = 0.9, density = 1) {
    const ab = b.map((value, i) => value - a[i]) as Vec3;
    const ac = c.map((value, i) => value - a[i]) as Vec3;
    const n = cross(ab, ac);
    const normal = normalize(n);
    this.surfaces.push({
      weight: Math.hypot(...n) * 0.5 * density,
      sample(random) {
        const u = Math.sqrt(random());
        const v = random();
        const point = a.map(
          (value, i) => value * (1 - u) + b[i] * u * (1 - v) + c[i] * u * v,
        ) as Vec3;
        return shaded(point, normal, brightness, random);
      },
    });
  }

  transform(start: number, scale: number, offset: Vec3) {
    for (let i = start; i < this.surfaces.length; i++) {
      const sample = this.surfaces[i].sample;
      this.surfaces[i].sample = (random) => {
        const point = sample(random);
        return {
          x: point.x * scale + offset[0],
          y: point.y * scale + offset[1],
          z: point.z * scale + offset[2],
          brightness: point.brightness,
        };
      };
      this.surfaces[i].weight *= scale * scale;
    }
  }
}

function wheel(s: Sculptor, x: number, y: number, z: number, radius: number) {
  const side = z < 0 ? -1 : 1;
  s.cylinder([x, y, z - 0.025], [x, y, z + 0.025], radius, 0.37, 0.7);
  s.ring([x, y, z + side * 0.031], [0, 0, 1], radius * 0.92, 0.024, 1.1, 2);
  s.cylinder([x, y, z], [x, y, z + side * 0.05], radius * 0.19, 1, 2);
  for (let spoke = 0; spoke < 9; spoke++) {
    const angle = (spoke / 9) * TAU;
    s.cylinder(
      [x, y, z + side * 0.035],
      [
        x + Math.cos(angle) * radius * 0.85,
        y + Math.sin(angle) * radius * 0.85,
        z + side * 0.035,
      ],
      0.009,
      0.97,
      1.6,
    );
  }
}

function locomotive(s: Sculptor) {
  // The boiler and three exposed driving wheels establish the steam-engine silhouette.
  s.cylinder([-0.52, -0.015, 0], [0.84, -0.015, 0], 0.285, 1, 1.2);
  s.cylinder([0.835, -0.015, 0], [0.885, -0.015, 0], 0.294, 0.7, 1.4);
  s.ring([0.891, -0.015, 0], [1, 0, 0], 0.26, 0.018, 1.05, 2);
  s.cylinder([0.9, -0.015, 0], [0.924, -0.015, 0], 0.065, 1, 2);
  for (const x of [-0.36, 0.02, 0.42])
    s.ring([x, -0.015, 0], [1, 0, 0], 0.288, 0.012, 1, 2);
  s.box([0.015, -0.335, 0], [1.98, 0.11, 0.72], 0.82);
  s.box([0.05, -0.265, 0.355], [1.6, 0.035, 0.08], 1, 2);
  s.box([0.05, -0.265, -0.355], [1.6, 0.035, 0.08], 1, 2);

  // Hollow cab windows preserve negative space in the particle volume.
  s.box([-0.715, 0.04, 0], [0.55, 0.68, 0.67], 0.86, 1, (point, normal) => {
    if (
      Math.abs(normal[2]) > 0.5 &&
      point[1] > 0.015 &&
      point[1] < 0.275 &&
      point[0] > -0.91 &&
      point[0] < -0.54
    )
      return false;
    if (
      Math.abs(normal[0]) > 0.5 &&
      point[1] > 0.03 &&
      point[1] < 0.265 &&
      Math.abs(point[2]) < 0.22
    )
      return false;
    return true;
  });
  s.box([-0.74, 0.398, 0], [0.73, 0.075, 0.82], 1.12, 1.3);
  for (const z of [-0.343, 0.343]) {
    s.box([-0.725, 0.01, z], [0.4, 0.025, 0.015], 1.1, 2);
    s.box([-0.725, 0.282, z], [0.4, 0.024, 0.015], 1.1, 2);
    s.box([-0.72, 0.145, z], [0.018, 0.26, 0.015], 1, 2);
    s.cylinder([-0.97, -0.265, z], [-0.97, 0.03, z], 0.012, 1, 1.5);
    s.box([-0.89, -0.43, z * 1.15], [0.28, 0.03, 0.16], 0.9, 1.5);
  }

  s.cylinder([0.56, 0.21, 0], [0.56, 0.58, 0], 0.09, 0.94, 1.3, 0.105);
  s.cylinder([0.56, 0.565, 0], [0.56, 0.665, 0], 0.104, 0.96, 1.5, 0.146);
  s.ring([0.56, 0.67, 0], [0, 1, 0], 0.135, 0.012, 1, 2);
  s.ellipsoid([-0.16, 0.277, 0], [0.12, 0.135, 0.12], 1, 1);
  s.cylinder([0.17, 0.266, 0], [0.17, 0.36, 0], 0.065, 0.95, 1);
  s.ellipsoid([0.17, 0.36, 0], [0.073, 0.04, 0.073], 1, 1);
  s.cylinder([0.87, 0.185, 0], [0.975, 0.185, 0], 0.065, 1.1, 2);

  for (const z of [-0.357, 0.357]) {
    for (const x of [-0.37, 0.06, 0.49]) wheel(s, x, -0.428, z, 0.226);
    wheel(s, 0.95, -0.485, z, 0.15);
    const side = z < 0 ? -1 : 1;
    s.cylinder(
      [-0.43, -0.422, z + side * 0.09],
      [0.64, -0.422, z + side * 0.09],
      0.022,
      1.15,
      2.5,
    );
    s.cylinder(
      [0.52, -0.425, z + side * 0.07],
      [0.76, -0.265, z + side * 0.07],
      0.017,
      1,
      1.5,
    );
  }

  // A slatted cowcatcher gives the front a characteristic triangular profile.
  for (let i = 0; i < 9; i++) {
    const z = (i / 8 - 0.5) * 0.7;
    s.cylinder([0.96, -0.34, z * 0.75], [1.19, -0.565, z], 0.014, 0.96, 1.7);
  }
  s.box([1.19, -0.566, 0], [0.04, 0.04, 0.75], 1, 1.5);

  // Small coal tender, with an uneven coal surface and its own wheelbase.
  s.box([-1.287, -0.12, 0], [0.43, 0.41, 0.64], 0.71, 0.9);
  s.box([-1.287, 0.1, 0], [0.47, 0.045, 0.69], 0.95, 1.2);
  for (let i = 0; i < 7; i++) {
    s.ellipsoid(
      [
        -1.4 + (i % 3) * 0.1,
        0.095 + (i % 2) * 0.035,
        -0.18 + Math.floor(i / 3) * 0.15,
      ],
      [0.085, 0.065, 0.09],
      0.47,
      0.6,
    );
  }
  for (const z of [-0.33, 0.33]) {
    wheel(s, -1.41, -0.485, z, 0.153);
    wheel(s, -1.14, -0.485, z, 0.153);
  }
  s.box([-1.035, -0.32, 0], [0.15, 0.05, 0.08], 0.9, 1);

  // Sparse drifting smoke retains a granular, permeable silhouette.
  s.ellipsoid([0.57, 0.78, 0], [0.11, 0.13, 0.11], 0.34, 0.27);
  s.ellipsoid([0.44, 0.94, 0.015], [0.18, 0.125, 0.15], 0.27, 0.2);
  s.ellipsoid([0.21, 1.035, 0.035], [0.245, 0.12, 0.17], 0.21, 0.13);
}

function railroad(s: Sculptor, y = -0.27, length = 3.2) {
  for (const z of [-0.34, 0.34]) {
    s.box([0, y, z], [length, 0.045, 0.07], 1.2, 1.9);
    s.box([0, y - 0.043, z], [length, 0.065, 0.025], 0.74, 1);
    s.box([0, y - 0.076, z], [length, 0.023, 0.115], 0.91, 1.2);
  }
  const ties = Math.floor(length / 0.18);
  for (let i = 0; i <= ties; i++) {
    const x = (i / ties - 0.5) * (length - 0.06);
    s.box([x, y - 0.118, 0], [0.09, 0.069, 1.015], 0.72, 0.9);
    for (const z of [-0.405, -0.275, 0.275, 0.405])
      s.box([x, y - 0.075, z], [0.035, 0.032, 0.025], 0.9, 1.5);
  }
  const random = randomSource(781);
  for (let i = 0; i < 80; i++) {
    const x = (random() - 0.5) * length;
    const z = (random() - 0.5) * 1.18;
    s.ellipsoid(
      [x, y - 0.167, z],
      [
        0.03 + random() * 0.025,
        0.012 + random() * 0.015,
        0.025 + random() * 0.018,
      ],
      0.3,
      0.22,
    );
  }
}

function factory(s: Sculptor) {
  const windows: SurfaceFilter = (point, normal) => {
    if (Math.abs(normal[2]) > 0.5 && point[1] > -0.31 && point[1] < 0.04) {
      const column = (((point[0] + 1.04) % 0.28) + 0.28) % 0.28;
      if (column > 0.055 && column < 0.215) return false;
    }
    return true;
  };
  s.box([0, -0.27, 0], [2.13, 0.62, 0.84], 0.76, 1, windows);
  s.box([0, -0.602, 0], [2.3, 0.05, 1.02], 0.67, 0.8);
  s.box([0, -0.025, 0.427], [2.16, 0.04, 0.025], 1, 1.6);
  for (let bay = 0; bay < 4; bay++) {
    const left = -1.065 + bay * 0.5325;
    const peak = left + 0.405;
    const right = left + 0.5325;
    const low = 0.05;
    const high = 0.37;
    for (const z of [-0.42, 0.42]) {
      s.triangle([left, low, z], [peak, high, z], [right, low, z], 0.84);
      s.cylinder([left, low, z], [peak, high, z], 0.011, 1.15, 2);
      s.cylinder([peak, high, z], [right, low, z], 0.011, 1.15, 2);
    }
    s.triangle([left, low, -0.42], [left, low, 0.42], [peak, high, 0.42], 1.03);
    s.triangle(
      [left, low, -0.42],
      [peak, high, 0.42],
      [peak, high, -0.42],
      1.03,
    );
    s.triangle(
      [peak, high, -0.42],
      [peak, high, 0.42],
      [right, low, 0.42],
      0.52,
      0.75,
    );
    s.triangle(
      [peak, high, -0.42],
      [right, low, 0.42],
      [right, low, -0.42],
      0.52,
      0.75,
    );
  }
  for (const z of [-0.426, 0.426]) {
    for (let col = 0; col < 7; col++) {
      const x = -0.91 + col * 0.28;
      for (const dx of [-0.08, 0.08])
        s.box([x + dx, -0.133, z], [0.015, 0.34, 0.012], 1, 1.3);
      for (const y of [-0.3, -0.13, 0.038])
        s.box([x, y, z], [0.175, 0.014, 0.012], 0.94, 1.4);
      s.box([x, -0.13, z], [0.012, 0.33, 0.012], 0.86, 1.4);
    }
  }
  // Tall, tapered brick stacks, attached to the rear of the mill.
  for (let i = 0; i < 3; i++) {
    const x = -0.63 + i * 0.64;
    const height = i === 1 ? 1.04 : 0.86 - i * 0.045;
    s.cylinder([x, -0.49, -0.285], [x, height, -0.285], 0.1, 0.77, 1.1, 0.071);
    s.cylinder([x, height - 0.07, -0.285], [x, height, -0.285], 0.091, 1, 1.5);
    for (let j = 0; j < 6; j++)
      s.ring([x, j * 0.19 - 0.21, -0.285], [0, 1, 0], 0.084, 0.006, 0.84, 1.8);
    s.ellipsoid(
      [x - 0.055, height + 0.1, -0.285],
      [0.13, 0.1, 0.11],
      0.23,
      0.18,
    );
  }
  // Loading doors, annex, rooftop pipes, and an exterior stair.
  s.box([1.2, -0.39, 0.035], [0.36, 0.36, 0.62], 0.75);
  s.box([1.205, -0.194, 0.035], [0.43, 0.04, 0.69], 1.05);
  s.box([1.387, -0.39, 0.08], [0.01, 0.28, 0.3], 0.28, 0.5);
  for (let row = 0; row < 8; row++)
    s.box([1.397, -0.51 + row * 0.035, 0.08], [0.015, 0.01, 0.31], 0.92, 1.7);
  s.cylinder([-0.87, -0.28, -0.44], [-0.87, 0.49, -0.44], 0.024, 0.97, 1.2);
  s.cylinder([-0.87, 0.49, -0.44], [-0.61, 0.49, -0.44], 0.024, 0.97, 1.2);
}

function human(s: Sculptor) {
  // A sculptural human bust. The face looks toward +Z.
  s.ellipsoid(
    [0, -0.52, -0.025],
    [0.68, 0.38, 0.31],
    0.74,
    1.15,
    (p) => p[1] > -0.795,
  );
  s.ellipsoid([-0.37, -0.3, -0.025], [0.24, 0.17, 0.22], 0.79, 0.7);
  s.ellipsoid([0.37, -0.3, -0.025], [0.24, 0.17, 0.22], 0.79, 0.7);
  s.cylinder([0, -0.4, 0], [0, -0.04, 0], 0.15, 0.83, 1.1, 0.125);
  s.ellipsoid([0, 0.35, -0.02], [0.284, 0.387, 0.259], 0.89, 1.5, (p) => {
    if (p[2] < 0.15) return true;
    // Eye sockets and mouth are omissions, not dark painted dots.
    const eye = Math.abs(p[0]);
    if (eye > 0.045 && eye < 0.182 && p[1] > 0.356 && p[1] < 0.414)
      return false;
    if (Math.abs(p[0]) < 0.105 && p[1] > 0.174 && p[1] < 0.196) return false;
    return true;
  });
  s.ellipsoid(
    [0, 0.13, 0.095],
    [0.197, 0.15, 0.167],
    0.82,
    0.85,
    (p) => p[1] < 0.205,
  );
  for (const side of [-1, 1]) {
    s.ellipsoid(
      [side * 0.274, 0.325, -0.005],
      [0.043, 0.092, 0.057],
      0.75,
      0.8,
    );
    s.cylinder(
      [side * 0.049, 0.43, 0.216],
      [side * 0.184, 0.415, 0.183],
      0.017,
      1.03,
      1.1,
    );
    s.ellipsoid(
      [side * 0.146, 0.292, 0.174],
      [0.078, 0.076, 0.075],
      0.94,
      0.75,
    );
    s.cylinder(
      [side * 0.03, -0.28, 0.163],
      [side * 0.36, -0.32, 0.207],
      0.016,
      1.01,
      1.4,
    );
  }
  s.ellipsoid([0, 0.333, 0.255], [0.041, 0.117, 0.057], 1, 1.1);
  s.ellipsoid([0, 0.272, 0.302], [0.054, 0.035, 0.043], 1.06, 1.4);
  s.cylinder([-0.072, 0.201, 0.242], [0, 0.206, 0.26], 0.013, 0.87, 1);
  s.cylinder([0, 0.206, 0.26], [0.072, 0.201, 0.242], 0.013, 0.87, 1);
  s.ellipsoid([0, 0.119, 0.212], [0.085, 0.05, 0.031], 0.93, 0.7);
  // Hair cap, sampled with shallow directional ridges.
  s.ellipsoid(
    [0, 0.385, -0.032],
    [0.292, 0.37, 0.26],
    0.52,
    0.6,
    (p) => p[1] > 0.54 || (p[2] < -0.07 && p[1] > 0.26),
  );
  s.cylinder([0, -0.83, 0], [0, -0.78, 0], 0.42, 0.88, 1.4);
}

function intelligence(s: Sculptor) {
  // A neural core inside three orbital paths: a recognizable synthetic intelligence.
  s.ellipsoid([-0.163, 0.035, 0], [0.24, 0.32, 0.26], 0.78, 1.2, (p) => {
    const groove = Math.sin(p[1] * 42 + Math.sin(p[2] * 29) * 1.8);
    return groove > -0.68;
  });
  s.ellipsoid([0.163, 0.035, 0], [0.24, 0.32, 0.26], 0.78, 1.2, (p) => {
    const groove = Math.sin(p[1] * 42 - Math.sin(p[2] * 29) * 1.8);
    return groove > -0.68;
  });
  const orbitNormals: Vec3[] = [
    [0.2, 1, 0.15],
    [0.8, 0.15, 0.6],
    [-0.75, 0.2, 0.65],
  ];
  for (let i = 0; i < orbitNormals.length; i++) {
    s.ring([0, 0, 0], orbitNormals[i], 0.7 + i * 0.045, 0.014, 1.05, 2.2);
    s.ring([0, 0, 0], orbitNormals[i], 0.727 + i * 0.045, 0.004, 0.46, 1);
  }
  const nodes: Vec3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 24; i++) {
    const y = 1 - (i / 23) * 2;
    const radius = Math.sqrt(1 - y * y);
    const angle = goldenAngle * i;
    const point: Vec3 = [
      Math.cos(angle) * radius * 0.55,
      y * 0.57,
      Math.sin(angle) * radius * 0.55,
    ];
    nodes.push(point);
    s.ellipsoid(point, [0.029, 0.029, 0.029], 1.15, 2.2);
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const distance = Math.hypot(
        ...nodes[i].map((value, axis) => value - nodes[j][axis]),
      );
      if (distance < 0.43) s.cylinder(nodes[i], nodes[j], 0.0045, 0.66, 0.8);
    }
  }
  s.ellipsoid([0.677, 0.035, -0.13], [0.053, 0.053, 0.053], 1.2, 2);
  s.ellipsoid([-0.405, 0.513, 0.19], [0.047, 0.047, 0.047], 1.2, 2);
  s.ellipsoid([-0.32, -0.481, -0.475], [0.04, 0.04, 0.04], 1.2, 2);
}

/** Equal-length, seeded point clouds allow particles to morph between every scene. */
export function generateShape(scene: SceneId, count: number): ParticlePoint[] {
  if (!Number.isFinite(count) || count < 1) return [];
  const size = Math.floor(count);
  const sculptor = new Sculptor();
  switch (scene) {
    case "train":
      locomotive(sculptor);
      break;
    case "railroad":
      railroad(sculptor);
      break;
    case "journey":
      railroad(sculptor, -0.55, 3.45);
      {
        const start = sculptor.surfaces.length;
        locomotive(sculptor);
        sculptor.transform(start, 0.8, [0, -0.005, 0]);
      }
      break;
    case "factory":
      factory(sculptor);
      break;
    case "human":
      human(sculptor);
      break;
    case "ai":
      intelligence(sculptor);
      break;
  }

  const random = randomSource(
    0x94f21 +
      scene
        .split("")
        .reduce((hash, letter) => hash * 31 + letter.charCodeAt(0), 0),
  );
  const totalWeight = sculptor.surfaces.reduce(
    (sum, surface) => sum + surface.weight,
    0,
  );
  const points: ParticlePoint[] = [];
  // Stratification keeps even small previews detailed and avoids losing tiny parts.
  let surfaceIndex = 0;
  let cumulativeWeight = sculptor.surfaces[0].weight;
  for (let i = 0; i < size; i++) {
    const target = ((i + random()) / size) * totalWeight;
    while (
      target > cumulativeWeight &&
      surfaceIndex < sculptor.surfaces.length - 1
    ) {
      surfaceIndex++;
      cumulativeWeight += sculptor.surfaces[surfaceIndex].weight;
    }
    points.push(sculptor.surfaces[surfaceIndex].sample(random));
  }
  // Spatially independent correspondence makes morphing feel like material reforming.
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }
  return points;
}
