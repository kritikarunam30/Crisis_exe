import * as THREE from 'three';

// Direction the sunlight comes from, in camera space (the camera never rotates)
export const SUN_DIRECTION = new THREE.Vector3(4.2, 1.6, 2.6).normalize();

function solidTexture(r, g, b) {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Photoreal Earth surface: day map lit by the sun, city lights on the night
 * side, a sun glint on the oceans, a drifting cloud layer with soft shadows,
 * and blue atmospheric haze towards the limb.
 */
export function createEarthMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: solidTexture(18, 38, 66) },
      nightMap: { value: solidTexture(0, 0, 0) },
      cloudMap: { value: solidTexture(0, 0, 0) },
      oceanMap: { value: solidTexture(0, 0, 0) },
      sunDirection: { value: SUN_DIRECTION.clone() },
      cloudOffset: { value: 0 },
      cloudAmount: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform sampler2D cloudMap;
      uniform sampler2D oceanMap;
      uniform vec3 sunDirection;
      uniform float cloudOffset;
      uniform float cloudAmount;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      const vec3 ATMOSPHERE = vec3(0.30, 0.56, 1.0);
      const vec3 SUNSET = vec3(1.0, 0.45, 0.2);

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(-vViewPosition);
        float sunDot = dot(N, sunDirection);

        // Soft terminator instead of a hard lit/unlit edge
        float daylight = smoothstep(-0.12, 0.35, sunDot);
        float diffuse = clamp(sunDot * 1.15 + 0.12, 0.0, 1.0);

        vec3 dayColor = texture2D(dayMap, vUv).rgb;
        float ocean = texture2D(oceanMap, vUv).r;

        vec2 cloudUv = vec2(vUv.x + cloudOffset, vUv.y);
        float cloud = smoothstep(0.08, 0.85, texture2D(cloudMap, cloudUv).r) * cloudAmount;
        // Shadow cast by clouds, sampled slightly towards the sun
        float cloudShadow = smoothstep(0.08, 0.85, texture2D(cloudMap, cloudUv + vec2(0.0025, 0.0012)).r) * cloudAmount;

        vec3 surface = dayColor * diffuse * (1.0 - 0.35 * cloudShadow);

        // Sun glint on water
        vec3 H = normalize(sunDirection + V);
        float glint = pow(max(dot(N, H), 0.0), 70.0);
        surface += vec3(1.0, 0.95, 0.85) * glint * ocean * 0.55 * (1.0 - cloud);

        // Clouds, warmed where the sun is low
        vec3 cloudColor = mix(SUNSET, vec3(1.0), smoothstep(0.0, 0.3, sunDot)) * diffuse;
        vec3 color = mix(surface, cloudColor, cloud * 0.88);

        // City lights on the night side, dimmed under cloud
        vec3 lights = texture2D(nightMap, vUv).rgb;
        color += lights * vec3(1.0, 0.82, 0.55) * (1.0 - daylight) * (1.0 - 0.75 * cloud) * 1.6;

        // Atmospheric haze: thin overall, thick and blue near the limb
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.2);
        color += ATMOSPHERE * 0.05 * daylight;
        color = mix(color, ATMOSPHERE * (0.35 + 0.75 * diffuse), fresnel * 0.6 * (0.12 + 0.88 * daylight));

        gl_FragColor = vec4(color * 0.8, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
