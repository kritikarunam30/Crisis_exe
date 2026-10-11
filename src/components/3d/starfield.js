import * as THREE from 'three';

/**
 * Creates a quiet, realistic star background: many faint pinpoint stars and a
 * few brighter ones, all near-white.
 */
export function createStarfield(count = 3200, radius = 90) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const starColors = [
    new THREE.Color(0xffffff), // white
    new THREE.Color(0xdfe9ff), // cool white
    new THREE.Color(0xfff4e0), // warm white
  ];

  for (let i = 0; i < count; i++) {
    // Generate random point on or within sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = radius * (0.8 + Math.random() * 0.4);

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Most stars are faint; brightness is baked into the colour
    const brightness = 0.12 + Math.pow(Math.random(), 4) * 0.88;
    const col = starColors[Math.floor(Math.random() * starColors.length)];
    colors[i * 3]     = col.r * brightness;
    colors[i * 3 + 1] = col.g * brightness;
    colors[i * 3 + 2] = col.b * brightness;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);

  function update(time) {
    points.rotation.y = time * 0.005;
    points.rotation.x = time * 0.002;
  }

  return { points, update };
}
