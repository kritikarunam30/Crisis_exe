import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createAtmosphereMaterial, ATMOSPHERE_RADIUS } from './AtmosphereShader.js';
import { createEarthMaterial } from './earthMaterial.js';
import { loadEarthTextures } from './textureHelper.js';
import { createIndiaBoundary, createIndiaLocator, createCityMarkers } from './geoMeshes.js';
import { createStarfield } from './starfield.js';
import { INDIA_CENTER, CITY_LOCATIONS, getRotationForLocation } from '../../data/cityLocations.js';

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

// Landing-page framing: the planet sits below the screen so only its upper
// horizon shows, tilted so the band of latitudes around India is in view.
const IDLE_Y = -2.46;
const IDLE_SCALE = 2.3;
const IDLE_RX = -0.5;
const IDLE_START_RY = getRotationForLocation(INDIA_CENTER.lat, INDIA_CENTER.lon).ry - 0.45;

// Ease helper: cubic ease-in-out
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function EarthCanvas({
  assignedCity,
  transitionStage = 'idle', // 'idle' | 'clearing' | 'centering' | 'revolving' | 'locking_india' | 'zooming_india' | 'zooming_city' | 'revealed'
  onStageComplete,
  className = '',
}) {
  const containerRef = useRef(null);
  const [webglSupported] = useState(() => isWebGLAvailable());

  // Callback ref to keep fresh in render loop without re-triggering effect
  const onStageCompleteRef = useRef(onStageComplete);
  useEffect(() => {
    onStageCompleteRef.current = onStageComplete;
  }, [onStageComplete]);

  // References to keep between renders
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const earthGroupRef = useRef(null);
  const globeMeshRef = useRef(null);
  const starfieldRef = useRef(null);
  const indiaBoundaryRef = useRef(null);
  const indiaLocatorRef = useRef(null);
  const cityMarkersRef = useRef(null);

  // Motion state
  const animStateRef = useRef({
    currentStage: 'idle',
    stageStartTime: 0,
    stageDuration: 0,
    fromPos: new THREE.Vector3(0, IDLE_Y, 0),
    toPos: new THREE.Vector3(0, IDLE_Y, 0),
    fromScale: IDLE_SCALE,
    toScale: IDLE_SCALE,
    fromCameraZ: 3.6,
    toCameraZ: 3.6,
    fromRx: IDLE_RX,
    toRx: IDLE_RX,
    fromRy: 0,
    toRy: 0,
    revolutionBaseRy: 0,
  });

  // Track assigned city changes
  useEffect(() => {
    if (assignedCity && cityMarkersRef.current) {
      cityMarkersRef.current.setActiveCity(assignedCity.name);
    }
  }, [assignedCity]);

  // Stage transition coordinator
  useEffect(() => {
    const state = animStateRef.current;
    if (state.currentStage === transitionStage) return;

    state.currentStage = transitionStage;
    state.stageStartTime = performance.now();

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const durMult = prefersReducedMotion ? 0.2 : 1.0;

    const earthGroup = earthGroupRef.current;
    const camera = cameraRef.current;
    if (!earthGroup || !camera) return;

    const curPos = earthGroup.position.clone();
    const curScale = earthGroup.scale.x;
    const curRx = earthGroup.rotation.x;
    const curRy = earthGroup.rotation.y;
    const curCamZ = camera.position.z;

    if (transitionStage === 'idle') {
      state.fromPos.copy(curPos);
      state.toPos.set(0, IDLE_Y, 0);
      state.fromScale = curScale;
      state.toScale = IDLE_SCALE;
      state.fromRx = curRx;
      state.toRx = IDLE_RX;
      state.fromCameraZ = curCamZ;
      state.toCameraZ = 3.6;
      state.stageDuration = 0;
      if (indiaBoundaryRef.current) indiaBoundaryRef.current.setOpacity(0);
      if (indiaLocatorRef.current) indiaLocatorRef.current.setOpacity(0);
      if (cityMarkersRef.current) cityMarkersRef.current.setOpacity(0);
    } else if (transitionStage === 'clearing') {
      // Step 1: UI fades out, earth remains in position
      state.stageDuration = 700 * durMult;
      state.fromPos.copy(curPos);
      state.toPos.copy(curPos);
      state.fromScale = curScale;
      state.toScale = curScale;
      state.fromRx = curRx;
      state.toRx = curRx;
      state.fromRy = curRy;
      state.toRy = curRy;
      state.fromCameraZ = curCamZ;
      state.toCameraZ = curCamZ;
    } else if (transitionStage === 'centering') {
      // Step 2: Earth moves upward to center and scales down
      state.stageDuration = 1800 * durMult;
      state.fromPos.copy(curPos);
      state.toPos.set(0, 0, 0);
      state.fromScale = curScale;
      state.toScale = 1.0;
      state.fromRx = curRx;
      state.toRx = 0.0;
      state.fromRy = curRy;
      state.toRy = curRy;
      state.fromCameraZ = curCamZ;
      state.toCameraZ = 3.6;
    } else if (transitionStage === 'revolving') {
      // Step 3: Exactly ONE complete 360-degree revolution around vertical axis
      state.stageDuration = 2800 * durMult;
      state.fromPos.set(0, 0, 0);
      state.toPos.set(0, 0, 0);
      state.fromScale = 1.0;
      state.toScale = 1.0;
      state.fromRx = 0.0;
      state.toRx = 0.0;
      state.fromRy = curRy;
      // Complete full -360 degrees (-2*PI)
      state.toRy = curRy - Math.PI * 2;
      state.revolutionBaseRy = state.toRy;
      state.fromCameraZ = 3.6;
      state.toCameraZ = 3.6;
    } else if (transitionStage === 'locking_india') {
      // Step 4: Rotate smoothly to center India facing camera
      state.stageDuration = 1800 * durMult;
      const { rx: targetRx, ry: rawTargetRy } = getRotationForLocation(INDIA_CENTER.lat, INDIA_CENTER.lon);

      // Find shortest angular direction to targetRy from currentRy
      const diffRy = ((rawTargetRy - curRy) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      const targetRy = curRy + diffRy;

      state.fromPos.set(0, 0, 0);
      state.toPos.set(0, 0, 0);
      state.fromScale = 1.0;
      state.toScale = 1.0;
      state.fromRx = curRx;
      state.toRx = targetRx;
      state.fromRy = curRy;
      state.toRy = targetRy;
      state.fromCameraZ = 3.6;
      state.toCameraZ = 3.6;
    } else if (transitionStage === 'zooming_india') {
      // Step 5: Camera zooms from full globe into India close-up
      state.stageDuration = 2000 * durMult;
      state.fromPos.set(0, 0, 0);
      state.toPos.set(0, 0, 0);
      state.fromScale = 1.0;
      state.toScale = 1.0;
      state.fromRx = curRx;
      state.toRx = curRx; // keep stable
      state.fromRy = curRy;
      state.toRy = curRy;
      state.fromCameraZ = curCamZ;
      state.toCameraZ = 1.48; // close up on India
    } else if (transitionStage === 'zooming_city') {
      // Step 6: Zoom further into assigned city
      state.stageDuration = 2000 * durMult;
      const cityLoc = (assignedCity && CITY_LOCATIONS[assignedCity.name]) || CITY_LOCATIONS.Mumbai;
      const { rx: cityRx, ry: rawCityRy } = getRotationForLocation(cityLoc.lat, cityLoc.lon);
      const diffRy = ((rawCityRy - curRy) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      const cityRy = curRy + diffRy;

      state.fromPos.set(0, 0, 0);
      state.toPos.set(0, 0, 0);
      state.fromScale = 1.0;
      state.toScale = 1.0;
      state.fromRx = curRx;
      state.toRx = cityRx;
      state.fromRy = curRy;
      state.toRy = cityRy;
      state.fromCameraZ = curCamZ;
      state.toCameraZ = 1.34; // tight tactical lock
    } else if (transitionStage === 'revealed') {
      state.stageDuration = 0;
      const cityLoc = (assignedCity && CITY_LOCATIONS[assignedCity.name]) || CITY_LOCATIONS.Mumbai;
      const { rx: cityRx, ry: rawCityRy } = getRotationForLocation(cityLoc.lat, cityLoc.lon);
      const diffRy = ((rawCityRy - curRy) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      earthGroup.rotation.x = cityRx;
      earthGroup.rotation.y = curRy + diffRy;
      camera.position.z = 1.34;
      if (indiaBoundaryRef.current) indiaBoundaryRef.current.setOpacity(0.9);
      if (cityMarkersRef.current) {
        cityMarkersRef.current.setActiveCity(cityLoc.name);
        cityMarkersRef.current.setOpacity(1.0);
      }
    }
  }, [transitionStage, assignedCity]);

  // Three.js Scene Initialization
  useEffect(() => {
    if (!webglSupported) return;

    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3.6);
    cameraRef.current = camera;

    // 3. Renderer
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch {
      return;
    }

    // 4. Starfield
    const starfield = createStarfield(3000, 95);
    scene.add(starfield.points);
    starfieldRef.current = starfield;

    // 5. Lighting
    const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.6);
    sunLight.position.set(6, 3, 5);
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x0a1828, 0.7);
    scene.add(ambientLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 1.2);
    rimLight.position.set(-6, -2, -4);
    scene.add(rimLight);

    // 6. Earth Group
    const earthGroup = new THREE.Group();
    earthGroup.rotation.order = 'XYZ';
    earthGroup.position.set(0, IDLE_Y, 0);
    earthGroup.scale.setScalar(IDLE_SCALE);
    earthGroup.rotation.x = IDLE_RX;
    earthGroup.rotation.y = IDLE_START_RY;
    scene.add(earthGroup);
    earthGroupRef.current = earthGroup;

    // 7. Globe Mesh (day/night surface, clouds and haze are all in its shader)
    const globeGeo = new THREE.SphereGeometry(1, 128, 128);
    const globeMat = createEarthMaterial();
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    earthGroup.add(globeMesh);
    globeMeshRef.current = globeMesh;

    // 8. Load textures
    loadEarthTextures(globeMat, renderer.capabilities.getMaxAnisotropy());

    // 9. Atmosphere halo shell
    const atmosGeo = new THREE.SphereGeometry(ATMOSPHERE_RADIUS, 128, 128);
    const atmosMat = createAtmosphereMaterial();
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    earthGroup.add(atmosMesh);

    // 10. India Geographic Outline
    const indiaBoundary = createIndiaBoundary(1.003);
    earthGroup.add(indiaBoundary.group);
    indiaBoundaryRef.current = indiaBoundary;

    // 11. India Tactical Locator
    const indiaLocator = createIndiaLocator(1.004);
    earthGroup.add(indiaLocator.group);
    indiaLocatorRef.current = indiaLocator;

    // 12. City Markers
    const cityMarkers = createCityMarkers(1.004);
    earthGroup.add(cityMarkers.group);
    cityMarkersRef.current = cityMarkers;

    // Window Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 13. Render Loop
    let animationFrameId;
    let lastTime = performance.now();

    const animate = (currentTime) => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const state = animStateRef.current;
      const curStage = state.currentStage;

      // Update background starfield
      if (starfieldRef.current) {
        starfieldRef.current.update(currentTime * 0.001);
      }

      // Slow independent cloud drift
      globeMat.uniforms.cloudOffset.value = (globeMat.uniforms.cloudOffset.value + delta * 0.0003) % 1;
      // Thin the clouds out as the camera closes in, so the city lock stays readable
      globeMat.uniforms.cloudAmount.value = THREE.MathUtils.lerp(0.3, 1, THREE.MathUtils.smoothstep(camera.position.z, 1.4, 2.8));

      // Update locator tick animations
      if (indiaLocatorRef.current) {
        indiaLocatorRef.current.update(currentTime * 0.001);
      }

      // Update city beacon pulse waves
      if (cityMarkersRef.current) {
        cityMarkersRef.current.update(currentTime * 0.001);
      }

      if (curStage === 'idle') {
        // Slow ambient rotation of Earth in landing page
        earthGroup.rotation.y += delta * 0.035;
        // Keep earth at bottom
        earthGroup.position.set(0, IDLE_Y, 0);
        earthGroup.scale.setScalar(IDLE_SCALE);
        earthGroup.rotation.x = IDLE_RX;
        camera.position.z = 3.6;
      } else if (state.stageDuration > 0) {
        const elapsed = currentTime - state.stageStartTime;
        const progress = Math.min(1, elapsed / state.stageDuration);
        const ease = easeInOutCubic(progress);

        // Interpolate position
        earthGroup.position.lerpVectors(state.fromPos, state.toPos, ease);

        // Interpolate scale
        const s = THREE.MathUtils.lerp(state.fromScale, state.toScale, ease);
        earthGroup.scale.setScalar(s);

        // Interpolate rotation X
        earthGroup.rotation.x = THREE.MathUtils.lerp(state.fromRx, state.toRx, ease);

        // Interpolate rotation Y
        earthGroup.rotation.y = THREE.MathUtils.lerp(state.fromRy, state.toRy, ease);

        // Interpolate Camera Z
        camera.position.z = THREE.MathUtils.lerp(state.fromCameraZ, state.toCameraZ, ease);

        // Dynamic opacities based on step
        if (curStage === 'locking_india') {
          // Fade in India outline and locator
          const outlineAlpha = Math.min(1, ease * 1.2);
          if (indiaBoundaryRef.current) indiaBoundaryRef.current.setOpacity(outlineAlpha * 0.9);
          if (indiaLocatorRef.current) indiaLocatorRef.current.setOpacity(outlineAlpha);
        } else if (curStage === 'zooming_india') {
          if (indiaBoundaryRef.current) indiaBoundaryRef.current.setOpacity(0.95);
          if (indiaLocatorRef.current) indiaLocatorRef.current.setOpacity(0.9);
          // Show small city dots
          if (cityMarkersRef.current) cityMarkersRef.current.setOpacity(ease * 0.5);
        } else if (curStage === 'zooming_city') {
          if (indiaBoundaryRef.current) indiaBoundaryRef.current.setOpacity(0.75);
          if (indiaLocatorRef.current) indiaLocatorRef.current.setOpacity(0.3);
          // Full city marker beacon
          if (cityMarkersRef.current) cityMarkersRef.current.setOpacity(0.5 + ease * 0.5);
        }

        // Check if current stage completed
        if (progress >= 1) {
          state.stageDuration = 0; // prevent re-triggering
          if (onStageCompleteRef.current) {
            onStageCompleteRef.current(curStage);
          }
        }
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [webglSupported]);

  // Graceful 2D fallback for environments without WebGL
  if (!webglSupported) {
    return (
      <div className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}>
        {/* Starfield simulation */}
        <div className="absolute inset-0 bg-[#03070d]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,240,255,0.08),transparent_70%)]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-cyan-400/20 animate-[spin-slow_50s_linear_infinite]" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
      style={{ background: '#03070d' }}
    />
  );
}
