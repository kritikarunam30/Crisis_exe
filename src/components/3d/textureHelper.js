import * as THREE from 'three';

// Earth maps: Solar System Scope (solarsystemscope.com/textures), CC BY 4.0,
// derived from NASA Blue Marble / Earth Observatory imagery.
const TEXTURES = {
  dayPreview: '/textures/earth_day_2k.jpg',
  day: '/textures/earth_day_8k.jpg',
  night: '/textures/earth_night_4k.jpg',
  clouds: '/textures/earth_clouds_4k.jpg',
  ocean: '/textures/earth_ocean_2k.jpg',
};

/**
 * Loads the Earth maps into the earth material's uniforms as they arrive.
 * A small day map is shown first, then replaced by the full-resolution one.
 */
export function loadEarthTextures(material, maxAnisotropy = 1) {
  const loader = new THREE.TextureLoader();
  const uniforms = material.uniforms;

  const apply = (uniform, { color = false, repeatX = false } = {}) => (tex) => {
    if (color) tex.colorSpace = THREE.SRGBColorSpace;
    if (repeatX) tex.wrapS = THREE.RepeatWrapping;
    tex.anisotropy = maxAnisotropy;
    const previous = uniform.value;
    uniform.value = tex;
    if (previous) previous.dispose();
  };

  let fullDayLoaded = false;
  const applyDay = apply(uniforms.dayMap, { color: true });

  loader.load(TEXTURES.dayPreview, (tex) => {
    if (fullDayLoaded) tex.dispose();
    else applyDay(tex);
  });
  loader.load(TEXTURES.day, (tex) => {
    fullDayLoaded = true;
    applyDay(tex);
  });
  loader.load(TEXTURES.night, apply(uniforms.nightMap, { color: true }));
  loader.load(TEXTURES.clouds, apply(uniforms.cloudMap, { repeatX: true }));
  loader.load(TEXTURES.ocean, apply(uniforms.oceanMap));
}
