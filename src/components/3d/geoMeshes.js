import * as THREE from 'three';
import { INDIA_RINGS } from '../../data/indiaOutline.js';
import { INDIA_CENTER, CITY_LOCATIONS, latLonToVector3 } from '../../data/cityLocations.js';

/**
 * Creates 3D geographic boundary lines for India conforming to the sphere surface.
 */
export function createIndiaBoundary(radius = 1.003) {
  const group = new THREE.Group();
  const lineMaterials = [];

  for (const ring of INDIA_RINGS) {
    const points = [];
    for (const [lon, lat] of ring) {
      points.push(latLonToVector3(lat, lon, radius));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0,
      linewidth: 1.5,
      blending: THREE.AdditiveBlending,
    });
    lineMaterials.push(material);
    const line = new THREE.LineLoop(geometry, material);
    group.add(line);
  }

  function setOpacity(val) {
    for (const mat of lineMaterials) {
      mat.opacity = Math.max(0, Math.min(1, val));
    }
  }

  return { group, setOpacity, lineMaterials };
}

/**
 * Creates tactical radar locator rings and crosshairs at India's geographic center.
 */
export function createIndiaLocator(radius = 1.004) {
  const group = new THREE.Group();
  const centerPos = latLonToVector3(INDIA_CENTER.lat, INDIA_CENTER.lon, radius);

  // Position group at center and orient tangent to surface
  group.position.copy(centerPos);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), centerPos.clone().normalize());

  const materials = [];

  // Inner ring
  const innerGeo = new THREE.RingGeometry(0.04, 0.048, 32);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  materials.push(innerMat);
  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  group.add(innerMesh);

  // Outer dashed ring
  const outerGeo = new THREE.RingGeometry(0.09, 0.098, 48);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0x00e1ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  materials.push(outerMat);
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  group.add(outerMesh);

  // Crosshairs
  const crossPts = [
    new THREE.Vector3(-0.13, 0, 0), new THREE.Vector3(-0.06, 0, 0),
    new THREE.Vector3(0.06, 0, 0),  new THREE.Vector3(0.13, 0, 0),
    new THREE.Vector3(0, -0.13, 0), new THREE.Vector3(0, -0.06, 0),
    new THREE.Vector3(0, 0.06, 0),  new THREE.Vector3(0, 0.13, 0),
  ];
  const crossGeo = new THREE.BufferGeometry().setFromPoints(crossPts);
  const crossMat = new THREE.LineBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  materials.push(crossMat);
  const crossLines = new THREE.LineSegments(crossGeo, crossMat);
  group.add(crossLines);

  function setOpacity(val) {
    for (const m of materials) {
      m.opacity = Math.max(0, Math.min(1, val));
    }
  }

  function update(time) {
    outerMesh.rotation.z = time * 0.5;
    innerMesh.rotation.z = -time * 0.3;
  }

  return { group, setOpacity, update };
}

/**
 * Creates 3D markers for all supported Indian cities with an enhanced
 * glowing holographic light beam and radar ping for the selected city.
 */
export function createCityMarkers(radius = 1.004) {
  const group = new THREE.Group();
  const cityNodes = {};

  // Container for active city holographic beacon
  const beaconGroup = new THREE.Group();
  group.add(beaconGroup);

  // Vertical light column geometry
  const beamHeight = 0.28;
  const beamGeo = new THREE.CylinderGeometry(0.003, 0.012, beamHeight, 16, 1, true);
  beamGeo.translate(0, beamHeight / 2, 0); // anchor base at 0
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beaconGroup.add(beamMesh);

  // Expanding radar ping ring
  const pingGeo = new THREE.RingGeometry(0.01, 0.045, 32);
  const pingMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pingMesh = new THREE.Mesh(pingGeo, pingMat);
  beaconGroup.add(pingMesh);

  // Small node dots for each city
  const dotGeo = new THREE.SphereGeometry(0.008, 16, 16);
  const allDotMats = [];

  for (const [name, loc] of Object.entries(CITY_LOCATIONS)) {
    const pos = latLonToVector3(loc.lat, loc.lon, radius);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    allDotMats.push(dotMat);
    const dotMesh = new THREE.Mesh(dotGeo, dotMat);
    dotMesh.position.copy(pos);
    group.add(dotMesh);

    cityNodes[name] = { pos, loc, dotMesh, dotMat };
  }

  let _activeCityName = null;
  let _opacity = 0;

  function setActiveCity(cityName) {
    _activeCityName = cityName;
    const node = cityNodes[cityName];
    if (node) {
      beaconGroup.position.copy(node.pos);
      // Orient along surface normal
      const normal = node.pos.clone().normalize();
      beaconGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    }
  }

  function setOpacity(val) {
    _opacity = Math.max(0, Math.min(1, val));
    for (const m of allDotMats) {
      m.opacity = Math.max(0, Math.min(0.8, val));
    }
    beamMat.opacity = Math.max(0, Math.min(0.9, val));
    pingMat.opacity = Math.max(0, Math.min(0.85, val));
  }

  function update(time) {
    // Pulse expanding radar wave
    const pulse = (time * 1.5) % 1;
    pingMesh.scale.setScalar(0.5 + pulse * 1.8);
    pingMat.opacity = (1 - pulse) * 0.75 * _opacity;
  }

  return { group, setActiveCity, setOpacity, update, cityNodes };
}
