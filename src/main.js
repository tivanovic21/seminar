import * as THREE from "three";
import "./styles.css";

const canvas = document.querySelector("#scene");

const ui = {
  distance: document.querySelector("#distance"),
  effectiveDistance: document.querySelector("#effective-distance"),
  rssi: document.querySelector("#rssi"),
  doppler: document.querySelector("#doppler"),
  radial: document.querySelector("#radial"),
  speed: document.querySelector("#speed"),
  motionState: document.querySelector("#motion-state"),
  radialFormula: document.querySelector("#radial-formula"),
  dopplerFormula: document.querySelector("#doppler-formula"),
  rssiFormula: document.querySelector("#rssi-formula"),
  bars: [...document.querySelectorAll("#bars i")]
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101714);
scene.fog = new THREE.Fog(0x101714, 90, 210);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 700);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const clock = new THREE.Clock();
const basePosition = new THREE.Vector3(0, 0, 0);

const RSSI_AT_1M_DBM = -30;
const PATH_LOSS_EXPONENT = 2.7;
const SPEED_OF_LIGHT = 3e8;
const CARRIER_FREQUENCY_HZ = 3.5e9;

const keys = new Set();
let activeDemoMode = null;
let tangentAngle = 0;
const carState = {
  position: new THREE.Vector3(26, 0, 18),
  velocity: new THREE.Vector3(),
  heading: Math.PI + 0.55,
  throttle: 0
};

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(260, 260, 80, 80),
  new THREE.MeshStandardMaterial({ color: 0x1b2a21, roughness: 0.95, metalness: 0.02 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(240, 48, 0x7a9e7d, 0x314839);
grid.position.y = 0.025;
grid.material.transparent = true;
grid.material.opacity = 0.34;
scene.add(grid);

const referenceRing1m = new THREE.Mesh(
  new THREE.RingGeometry(0.94, 1.06, 96),
  new THREE.MeshBasicMaterial({
    color: 0x9ee7ff,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false
  })
);
referenceRing1m.rotation.x = -Math.PI / 2;
referenceRing1m.position.y = 0.11;
scene.add(referenceRing1m);

const station = new THREE.Group();
const tower = new THREE.Mesh(
  new THREE.CylinderGeometry(0.65, 0.9, 18, 12),
  new THREE.MeshStandardMaterial({ color: 0xd8e2dc, roughness: 0.45 })
);
tower.position.y = 9;
tower.castShadow = true;
station.add(tower);

const antenna = new THREE.Mesh(
  new THREE.BoxGeometry(4.8, 1.2, 0.42),
  new THREE.MeshStandardMaterial({ color: 0x74e39d, emissive: 0x184c2a, roughness: 0.38 })
);
antenna.position.y = 18.4;
antenna.castShadow = true;
station.add(antenna);

const beacon = new THREE.Mesh(
  new THREE.SphereGeometry(1.4, 24, 16),
  new THREE.MeshStandardMaterial({ color: 0xa7ffbf, emissive: 0x45b36a, emissiveIntensity: 0.8 })
);
beacon.position.y = 20.2;
station.add(beacon);
scene.add(station);

const car = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.BoxGeometry(3.8, 1.15, 6.2),
  new THREE.MeshStandardMaterial({ color: 0xf16f45, roughness: 0.42, metalness: 0.08 })
);
body.position.y = 0.92;
body.castShadow = true;
car.add(body);

const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(2.7, 0.95, 2.6),
  new THREE.MeshStandardMaterial({ color: 0x2d3e4f, roughness: 0.28, metalness: 0.15 })
);
cabin.position.set(0, 1.67, -0.55);
cabin.castShadow = true;
car.add(cabin);

const receiver = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 16, 12),
  new THREE.MeshStandardMaterial({ color: 0x9ee7ff, emissive: 0x167d9a, emissiveIntensity: 0.9 })
);
receiver.position.set(0, 2.36, -2.1);
car.add(receiver);

const receiverHalo = new THREE.Mesh(
  new THREE.RingGeometry(2.8, 3.35, 72),
  new THREE.MeshBasicMaterial({
    color: 0x64e28a,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false
  })
);
receiverHalo.rotation.x = -Math.PI / 2;
receiverHalo.position.y = 0.09;
car.add(receiverHalo);

for (const x of [-1.7, 1.7]) {
  for (const z of [-2.15, 2.15]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 0.42, 18),
      new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.8 })
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.48, z);
    wheel.castShadow = true;
    car.add(wheel);
  }
}
scene.add(car);

const buildings = [
  [-55, 40, 7, 12, 9],
  [60, -42, 8, 14, 10]
];

for (const [x, z, width, height, depth] of buildings) {
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: 0x34463b, roughness: 0.86 })
  );
  block.position.set(x, height / 2, z);
  block.castShadow = true;
  block.receiveShadow = true;
  scene.add(block);
}

const waveRings = Array.from({ length: 9 }, (_, index) => {
  const geometry = new THREE.RingGeometry(0.96, 1.04, 96);
  const material = new THREE.MeshBasicMaterial({
    color: 0x75ff9b,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  ring.userData.offset = index / 9;
  scene.add(ring);
  return ring;
});

const hemiLight = new THREE.HemisphereLight(0xd9fff0, 0x17231c, 2.1);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xfff3cc, 3.2);
sun.position.set(-35, 55, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
scene.add(sun);

function resetCar() {
  activeDemoMode = null;
  carState.position.set(26, 0, 18);
  carState.velocity.set(0, 0, 0);
  carState.heading = Math.PI + 0.55;
}

function applyDemoMode(mode) {
  activeDemoMode = mode;
  if (mode === "toward") {
    carState.position.set(48, 0, 0);
    carState.heading = -Math.PI / 2;
    carState.velocity.set(-12, 0, 0);
  } else if (mode === "away") {
    carState.position.set(20, 0, 0);
    carState.heading = Math.PI / 2;
    carState.velocity.set(12, 0, 0);
  } else if (mode === "tangent") {
    tangentAngle = 0;
    carState.position.set(34, 0, 0);
    carState.velocity.set(0, 0, 12);
    carState.heading = 0;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function qualityFromRssi(rssiDbm) {
  return clamp((rssiDbm + 105) / 65, 0, 1);
}

function qualityColor(quality) {
  if (quality > 0.66) return "#64e28a";
  if (quality > 0.36) return "#f1b742";
  return "#ee5b4f";
}

function motionStateFromRadialVelocity(radialVelocity) {
  if (radialVelocity > 0.45) return "približavanje: +f_D";
  if (radialVelocity < -0.45) return "udaljavanje: -f_D";
  return "paralelno: f_D = 0";
}

function updateCar(delta) {
  const forwardInput = Number(keys.has("KeyW") || keys.has("ArrowUp"));
  const reverseInput = Number(keys.has("KeyS") || keys.has("ArrowDown"));
  const steerLeft = Number(keys.has("KeyA") || keys.has("ArrowLeft"));
  const steerRight = Number(keys.has("KeyD") || keys.has("ArrowRight"));

  if (activeDemoMode && !forwardInput && !reverseInput && !steerLeft && !steerRight) {
    updateDemoCar(delta);
    return;
  }

  if (forwardInput || reverseInput || steerLeft || steerRight) {
    activeDemoMode = null;
  }

  const forward = new THREE.Vector3(Math.sin(carState.heading), 0, Math.cos(carState.heading));
  const speed = carState.velocity.length();
  const steer = steerLeft - steerRight;

  carState.heading += steer * delta * (1.25 + speed * 0.045) * (speed > 0.25 ? 1 : 0.35);

  const acceleration = forward.multiplyScalar((forwardInput - reverseInput * 0.72) * 24 * delta);
  carState.velocity.add(acceleration);
  carState.velocity.multiplyScalar(Math.pow(0.985, delta * 60));

  const maxSpeed = 35;
  if (carState.velocity.length() > maxSpeed) {
    carState.velocity.setLength(maxSpeed);
  }

  carState.position.addScaledVector(carState.velocity, delta);

  const stationClearance = 3.2;
  const distanceFromBase = carState.position.length();
  if (distanceFromBase < stationClearance) {
    const outward = carState.position.clone().normalize();
    if (outward.lengthSq() === 0) outward.set(1, 0, 0);
    carState.position.copy(outward.clone().multiplyScalar(stationClearance));
    if (carState.velocity.dot(outward) < 0) {
      carState.velocity.addScaledVector(outward, -carState.velocity.dot(outward));
    }
  }

  const worldLimit = 118;
  if (Math.abs(carState.position.x) > worldLimit || Math.abs(carState.position.z) > worldLimit) {
    carState.position.x = clamp(carState.position.x, -worldLimit, worldLimit);
    carState.position.z = clamp(carState.position.z, -worldLimit, worldLimit);
    carState.velocity.multiplyScalar(0.25);
  }

  car.position.copy(carState.position);
  car.rotation.y = carState.heading;
}

function updateDemoCar(delta) {
  if (activeDemoMode === "toward") {
    carState.position.x -= 12 * delta;
    if (carState.position.x < 7) carState.position.x = 52;
    carState.position.z = 0;
    carState.velocity.set(-12, 0, 0);
    carState.heading = -Math.PI / 2;
  } else if (activeDemoMode === "away") {
    carState.position.x += 12 * delta;
    if (carState.position.x > 60) carState.position.x = 12;
    carState.position.z = 0;
    carState.velocity.set(12, 0, 0);
    carState.heading = Math.PI / 2;
  } else if (activeDemoMode === "tangent") {
    const radius = 34;
    const angularSpeed = 0.35;
    tangentAngle += angularSpeed * delta;
    carState.position.set(Math.cos(tangentAngle) * radius, 0, Math.sin(tangentAngle) * radius);
    carState.velocity.set(
      -Math.sin(tangentAngle) * radius * angularSpeed,
      0,
      Math.cos(tangentAngle) * radius * angularSpeed
    );
    carState.heading = Math.atan2(carState.velocity.x, carState.velocity.z);
  }

  car.position.copy(carState.position);
  car.rotation.y = carState.heading;
}

function computeRadioValues() {
  const toBase = basePosition.clone().sub(carState.position);
  const actualDistance = toBase.length();
  const distance = Math.max(1, actualDistance);
  const directionToBase = toBase.normalize();
  const speed = carState.velocity.length();

  // Log-distance path loss model:
  // RSSI(d) = RSSI_1m - 10 * n * log10(d)
  // d is clamped to at least 1 m to avoid unrealistic infinity near the transmitter.
  const rssiDbm = RSSI_AT_1M_DBM - 10 * PATH_LOSS_EXPONENT * Math.log10(distance);

  // Doppler shift depends only on radial velocity.
  // Project the car velocity onto the direction from receiver to transmitter:
  // positive v_r means the receiver is moving toward the base station.
  const radialVelocity = carState.velocity.dot(directionToBase);

  // f_D = (v_r / c) * f_c, with a fixed 3.5 GHz carrier in this demo.
  const dopplerHz = (radialVelocity / SPEED_OF_LIGHT) * CARRIER_FREQUENCY_HZ;
  const quality = qualityFromRssi(rssiDbm);
  const radialAngleDeg = speed > 0.01
    ? THREE.MathUtils.radToDeg(Math.acos(clamp(radialVelocity / speed, -1, 1)))
    : 90;

  return {
    actualDistance,
    distance,
    rssiDbm,
    radialVelocity,
    dopplerHz,
    quality,
    speed,
    speedKmh: speed * 3.6,
    radialAngleDeg
  };
}

function updateWaves(time, quality) {
  const color = new THREE.Color(qualityColor(quality));
  for (const ring of waveRings) {
    const phase = (time * 0.12 + ring.userData.offset) % 1;
    const radius = 6 + phase * 95;
    ring.scale.setScalar(radius);
    ring.material.color.copy(color);
    ring.material.opacity = (1 - phase) * (0.16 + quality * 0.48);
  }
  beacon.material.emissive.copy(color);
  beacon.material.emissiveIntensity = 0.5 + quality * 1.1 + Math.sin(time * 4) * 0.08;
}

function updateReceiverIndicator(quality) {
  const color = new THREE.Color(qualityColor(quality));
  receiver.material.emissive.copy(color);
  receiver.material.emissiveIntensity = 0.65 + quality * 1.65;
  receiverHalo.material.color.copy(color);
  receiverHalo.material.opacity = 0.16 + quality * 0.5;
  receiverHalo.scale.setScalar(0.78 + quality * 0.45);
}

function updateCamera(delta) {
  const headingVector = new THREE.Vector3(Math.sin(carState.heading), 0, Math.cos(carState.heading));
  const cameraPosition = carState.position
    .clone()
    .addScaledVector(headingVector, -34)
    .add(new THREE.Vector3(0, 34, 0));
  const lookTarget = carState.position.clone().lerp(basePosition, 0.28);

  camera.position.lerp(cameraPosition, 1 - Math.pow(0.001, delta));
  camera.lookAt(lookTarget.x, 2.5, lookTarget.z);
}

function updateUi(values) {
  ui.distance.textContent = `${values.actualDistance.toFixed(1)} m`;
  ui.effectiveDistance.textContent = `d_eff = ${values.distance.toFixed(1)} m`;
  ui.rssi.textContent = `${values.rssiDbm.toFixed(1)} dBm`;
  ui.doppler.textContent = `${values.dopplerHz.toFixed(1)} Hz`;
  ui.radial.textContent = `${values.radialVelocity.toFixed(2)} m/s`;
  ui.speed.textContent = `${values.speedKmh.toFixed(1)} km/h`;
  ui.motionState.textContent = motionStateFromRadialVelocity(values.radialVelocity);
  ui.radialFormula.textContent =
    `v_r = v · cos(theta) = ${values.speed.toFixed(2)} · cos(${values.radialAngleDeg.toFixed(0)} deg) = ${values.radialVelocity.toFixed(2)} m/s`;
  ui.dopplerFormula.textContent =
    `f_D = (v_r / c) · f_c = (${values.radialVelocity.toFixed(2)} / 3e8) · 3.5e9 = ${values.dopplerHz.toFixed(1)} Hz`;
  ui.rssiFormula.textContent =
    `RSSI = -30 - 10 · 2.7 · log10(${values.distance.toFixed(1)}) = ${values.rssiDbm.toFixed(1)} dBm`;

  const activeBars = Math.ceil(values.quality * ui.bars.length);
  const color = qualityColor(values.quality);
  ui.bars.forEach((bar, index) => {
    bar.style.backgroundColor = index < activeBars ? color : "rgba(255,255,255,0.16)";
    bar.style.opacity = index < activeBars ? "1" : "0.55";
  });
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  updateCar(delta);
  const values = computeRadioValues();
  updateWaves(elapsed, values.quality);
  updateReceiverIndicator(values.quality);
  updateCamera(delta);
  updateUi(values);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") resetCar();
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

document.querySelectorAll("[data-demo]").forEach((button) => {
  button.addEventListener("click", () => {
    applyDemoMode(button.dataset.demo);
  });
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

resetCar();
animate();
