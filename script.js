const canvas = document.querySelector("#space");
const ctx = canvas.getContext("2d", { alpha: false });
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let width = 0;
let height = 0;
let dpr = 1;
let heartScale = 1;
let heartPoints = [];
let orbitDust = [];
let stars = [];
let lastTime = performance.now();

const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
const palette = [
  [255, 18, 103],
  [255, 37, 124],
  [255, 65, 151],
  [255, 98, 178],
  [255, 144, 204],
  [230, 89, 255],
  [255, 213, 235],
];

function rawHeartCurve(t) {
  const sin = Math.sin(t);
  return {
    x: (16 * sin * sin * sin) / 17,
    y: (
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t)
    ) / 17,
  };
}

function buildCurveLookup() {
  const lookup = [];
  const resolution = 2400;
  let previous = rawHeartCurve(0);
  let length = 0;
  lookup.push({ ...previous, t: 0, length: 0 });

  for (let i = 1; i <= resolution; i += 1) {
    const t = (i / resolution) * Math.PI * 2;
    const point = rawHeartCurve(t);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    lookup.push({ ...point, t, length });
    previous = point;
  }

  return { lookup, totalLength: length };
}

const curveData = buildCurveLookup();

function heartCurveAt(progress) {
  const target = ((progress % 1 + 1) % 1) * curveData.totalLength;
  const points = curveData.lookup;
  let low = 0;
  let high = points.length - 1;

  while (low < high) {
    const middle = (low + high) >> 1;
    if (points[middle].length < target) low = middle + 1;
    else high = middle;
  }

  const end = points[low];
  const start = points[Math.max(0, low - 1)];
  const span = Math.max(0.000001, end.length - start.length);
  const mix = (target - start.length) / span;
  return {
    x: start.x + (end.x - start.x) * mix,
    y: start.y + (end.y - start.y) * mix,
  };
}

function randomColor(bright = false) {
  const minimum = bright ? 1 : 0;
  return palette[minimum + Math.floor(Math.random() * (palette.length - minimum))];
}

function makeParticle(x, depth, vertical, edge, layer = 1) {
  return {
    x,
    y: depth,
    z: vertical,
    edge,
    layer,
    color: randomColor(edge),
    seed: Math.random() * Math.PI * 2,
    size: edge ? 0.65 + Math.random() * 1.45 : 0.35 + Math.random() * 1.05,
    alpha: edge ? 0.62 + Math.random() * 0.38 : 0.18 + Math.random() * 0.46,
    twinkle: 0.8 + Math.random() * 2.4,
    screenX: 0,
    screenY: 0,
    perspective: 1,
    depth: 0,
    shimmer: 1,
  };
}

function createHeart() {
  heartPoints = [];
  const mobile = width < 600;
  const outlineCount = mobile ? 1800 : 2800;
  const surfaceCount = mobile ? 2400 : 3700;

  // Several closely packed edge bands create a continuous, naturally rounded silhouette.
  for (let i = 0; i < outlineCount; i += 1) {
    const progress = (i + Math.random() * 0.85) / outlineCount;
    const curve = heartCurveAt(progress);
    const inset = 0.925 + Math.random() * 0.085;
    const edgeDepth = (Math.random() * 2 - 1) * (0.065 + (1 - inset) * 0.55);
    const jitter = (Math.random() - 0.5) * 0.009;
    heartPoints.push(makeParticle(
      curve.x * inset + jitter,
      edgeDepth,
      curve.y * inset + 0.055 + jitter,
      true,
      inset,
    ));
  }

  // Rounded front and rear surfaces give the flat heart genuine volume when it rotates.
  for (let i = 0; i < surfaceCount; i += 1) {
    const curve = heartCurveAt(Math.random());
    const radial = Math.pow(Math.random(), 0.43) * 0.945;
    const thickness = 0.46 * Math.sqrt(Math.max(0, 1 - radial * radial));
    const onSurface = Math.random() < 0.72;
    const side = Math.random() < 0.5 ? -1 : 1;
    const depth = onSurface
      ? side * thickness * (0.72 + Math.random() * 0.28)
      : (Math.random() * 2 - 1) * thickness;
    const jitter = (Math.random() - 0.5) * 0.012;
    heartPoints.push(makeParticle(
      curve.x * radial + jitter,
      depth,
      curve.y * radial + 0.055 + jitter,
      radial > 0.86,
      radial,
    ));
  }
}

function createSpace() {
  const starCount = Math.min(1400, Math.floor((width * height) / 880));
  stars = Array.from({ length: starCount }, () => ({
    x: (Math.random() * 2 - 1) * width,
    y: (Math.random() * 2 - 1) * height,
    z: 0.22 + Math.random() * 1.9,
    size: 0.18 + Math.random() * 1.2,
    alpha: 0.08 + Math.random() * 0.52,
    phase: Math.random() * Math.PI * 2,
    speed: 0.025 + Math.random() * 0.09,
    color: randomColor(),
  }));

  orbitDust = Array.from({ length: width < 600 ? 260 : 500 }, () => ({
    angle: Math.random() * Math.PI * 2,
    radius: 1.42 + Math.random() * 1.48,
    tilt: (Math.random() - 0.5) * 0.82,
    speed: (0.035 + Math.random() * 0.075) * (Math.random() < 0.5 ? -1 : 1),
    size: 0.3 + Math.random() * 1.45,
    alpha: 0.1 + Math.random() * 0.48,
    color: randomColor(),
    x: 0,
    y: 0,
    z: 0,
  }));
}

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  width = innerWidth;
  height = innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  heartScale = Math.min(width, height) * (width < 600 ? 0.34 : 0.355);
  createHeart();
  createSpace();
}

function heartbeat(time) {
  if (reducedMotion) return 1;
  const phase = (time % 1480) / 1480;
  const first = Math.exp(-((phase - 0.09) ** 2) / 0.0007) * 0.09;
  const second = Math.exp(-((phase - 0.205) ** 2) / 0.00115) * 0.055;
  const breath = Math.sin(time * 0.00135) * 0.009;
  return 1 + first + second + breath;
}

function rotatePoint(x, y, z, rotationY, rotationX) {
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const x1 = x * cosY + y * sinY;
  const depth1 = -x * sinY + y * cosY;
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  return {
    x: x1,
    y: -z * cosX - depth1 * sinX,
    z: -z * sinX + depth1 * cosX,
  };
}

function drawBackground(time, delta) {
  const background = ctx.createRadialGradient(
    width * 0.5,
    height * 0.49,
    0,
    width * 0.5,
    height * 0.49,
    Math.max(width, height) * 0.8,
  );
  background.addColorStop(0, "#16020f");
  background.addColorStop(0.3, "#090108");
  background.addColorStop(1, "#010103");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const star of stars) {
    if (!reducedMotion) {
      star.z -= star.speed * delta * 0.001;
      if (star.z < 0.17) {
        star.z = 2.1;
        star.x = (Math.random() * 2 - 1) * width;
        star.y = (Math.random() * 2 - 1) * height;
      }
    }

    const perspective = 0.48 / star.z;
    const x = width * 0.5 + star.x * perspective + pointer.x * 18 * (1 - star.z / 2.1);
    const y = height * 0.5 + star.y * perspective + pointer.y * 12 * (1 - star.z / 2.1);
    if (x < -6 || x > width + 6 || y < -6 || y > height + 6) continue;

    const twinkle = 0.68 + Math.sin(time * 0.002 + star.phase) * 0.32;
    const radius = Math.min(2.8, star.size * perspective * 1.55);
    const [r, g, b] = star.color;
    ctx.fillStyle = `rgba(${r},${g},${b},${star.alpha * twinkle})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.24, radius), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawOpticalBloom(pulse) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const beat = Math.max(0, Math.min(1, (pulse - 1) / 0.075));
  const radius = heartScale * (1.35 + beat * 0.18);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  glow.addColorStop(0, `rgba(255, 25, 112, ${0.18 + beat * 0.16})`);
  glow.addColorStop(0.23, `rgba(255, 16, 103, ${0.085 + beat * 0.07})`);
  glow.addColorStop(0.62, "rgba(201, 25, 126, 0.025)");
  glow.addColorStop(1, "rgba(255, 15, 100, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  if (beat > 0.04) {
    const flare = ctx.createLinearGradient(cx - heartScale, cy, cx + heartScale, cy);
    flare.addColorStop(0, "rgba(255,80,160,0)");
    flare.addColorStop(0.42, `rgba(255,90,170,${beat * 0.025})`);
    flare.addColorStop(0.5, `rgba(255,220,238,${beat * 0.18})`);
    flare.addColorStop(0.58, `rgba(255,90,170,${beat * 0.025})`);
    flare.addColorStop(1, "rgba(255,80,160,0)");
    ctx.fillStyle = flare;
    ctx.fillRect(cx - heartScale, cy - 0.6, heartScale * 2, 1.2);
  }
}

function drawOrbitDust(time, rotationY, rotationX, pulse) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const mote of orbitDust) {
    const angle = mote.angle + time * 0.001 * mote.speed;
    const point = rotatePoint(
      Math.cos(angle) * mote.radius,
      Math.sin(angle) * mote.radius,
      Math.sin(angle * 1.65 + mote.tilt * 5) * 0.5 + mote.tilt,
      rotationY * 0.3,
      rotationX * 0.3,
    );
    mote.x = point.x;
    mote.y = point.y;
    mote.z = point.z;
  }

  orbitDust.sort((a, b) => b.z - a.z);
  for (const mote of orbitDust) {
    const perspective = 3.4 / (4.5 + mote.z);
    const x = width * 0.5 + mote.x * heartScale * perspective * pulse;
    const y = height * 0.5 + mote.y * heartScale * perspective * pulse;
    const [r, g, b] = mote.color;
    const depthLight = Math.max(0.18, Math.min(1, 0.68 - mote.z * 0.16));
    ctx.fillStyle = `rgba(${r},${g},${b},${mote.alpha * depthLight})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.25, mote.size * perspective), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHeart(time, pulse, rotationY, rotationX) {
  const cx = width * 0.5;
  const cy = height * 0.5;

  for (const particle of heartPoints) {
    const point = rotatePoint(particle.x, particle.y, particle.z, rotationY, rotationX);
    particle.depth = point.z;
    particle.perspective = 3.8 / (4.6 + point.z);
    particle.screenX = cx + point.x * heartScale * particle.perspective * pulse;
    particle.screenY = cy + point.y * heartScale * particle.perspective * pulse;
    particle.shimmer = 0.72 + Math.sin(time * 0.001 * particle.twinkle + particle.seed) * 0.28;
  }

  heartPoints.sort((a, b) => b.depth - a.depth);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const particle of heartPoints) {
    const [r, g, b] = particle.color;
    const depthLight = Math.max(0.32, Math.min(1.18, 0.76 - particle.depth * 0.32));
    const edgeBoost = particle.edge ? 1.12 : 0.9;
    const alpha = Math.min(1, particle.alpha * particle.shimmer * depthLight * edgeBoost);
    const radius = particle.size * particle.perspective * (1 + (pulse - 1) * 2.6);

    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.beginPath();
    ctx.arc(particle.screenX, particle.screenY, Math.max(0.32, radius), 0, Math.PI * 2);
    ctx.fill();

    if (particle.edge && particle.size > 1.45 && particle.shimmer > 0.9) {
      ctx.fillStyle = `rgba(255,220,239,${alpha * 0.24})`;
      ctx.beginPath();
      ctx.arc(particle.screenX, particle.screenY, radius * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (particle.edge && particle.size > 1.72 && particle.shimmer > 0.97) {
      ctx.fillStyle = `rgba(255,245,249,${alpha * 0.72})`;
      ctx.beginPath();
      ctx.arc(particle.screenX, particle.screenY, Math.max(0.35, radius * 0.42), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function render(time) {
  const delta = Math.min(34, time - lastTime);
  lastTime = time;
  pointer.x += (pointer.targetX - pointer.x) * 0.035;
  pointer.y += (pointer.targetY - pointer.y) * 0.035;

  const pulse = heartbeat(time);
  const idleRotation = reducedMotion ? 0 : Math.sin(time * 0.0002) * 0.13;
  const rotationY = idleRotation + pointer.x * 0.22;
  const rotationX = -0.035 + pointer.y * 0.11;

  drawBackground(time, delta);
  drawOpticalBloom(pulse);
  drawOrbitDust(time, rotationY, rotationX, pulse);
  drawHeart(time, pulse, rotationY, rotationX);
  requestAnimationFrame(render);
}

addEventListener("resize", resize);
addEventListener("pointermove", (event) => {
  pointer.targetX = (event.clientX / width - 0.5) * 2;
  pointer.targetY = (event.clientY / height - 0.5) * 2;
});
addEventListener("pointerleave", () => {
  pointer.targetX = 0;
  pointer.targetY = 0;
});

resize();
requestAnimationFrame(render);
