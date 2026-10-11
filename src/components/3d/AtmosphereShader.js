import * as THREE from 'three';
import { SUN_DIRECTION } from './earthMaterial.js';

// Radius of the atmosphere shell relative to the globe
export const ATMOSPHERE_RADIUS = 1.045;

/**
 * Thin blue halo just outside the planet's edge. Rendered on the inside of a
 * slightly larger sphere: brightest where it meets the surface, fading to
 * nothing at the shell's outer edge, and only on the sunlit side.
 */
export function createAtmosphereMaterial() {
  // How far past edge-on the shell is where it meets the globe's silhouette
  const depthAtSurface = Math.sqrt(1 - 1 / (ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS));

  return new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform vec3 glowColor;
      uniform vec3 sunDirection;
      uniform float depthAtSurface;
      uniform float intensity;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 viewDir = normalize(-vPosition);
        // 0 at the shell's outer edge, 1 where the shell meets the planet
        float depth = clamp(-dot(N, viewDir) / depthAtSurface, 0.0, 1.0);
        float glow = pow(depth, 2.2);
        float lit = smoothstep(-0.25, 0.45, dot(N, sunDirection));
        gl_FragColor = vec4(glowColor, glow * intensity * (0.06 + 0.94 * lit));
      }
    `,
    uniforms: {
      glowColor: { value: new THREE.Color(0.32, 0.6, 1.0) },
      sunDirection: { value: SUN_DIRECTION.clone() },
      depthAtSurface: { value: depthAtSurface },
      intensity: { value: 0.9 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
}
