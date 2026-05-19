/* =========================================================
   RESEARCH 3D — interactive human brain mesh
   Loads assets/connectome.glb (6 named regions: frontal,
   parietal, occipital, temporal, cerebellum, brainstem),
   per-region hover glow keyed to interest tone, horizontal-
   only rotation (yaw), labels follow regions in screen space,
   first drag permanently stops auto-rotation, click opens the
   matching interest accordion.
   ========================================================= */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('brain-canvas');
if (canvas) {
  try {
    initResearch3D(canvas);
  } catch (e) {
    console.error('[research3d] init failed:', e);
  }
}

const TONE_HEX = {
  red:     0xff3b30,
  orange:  0xff8a1f,
  yellow:  0xffd23f,
  green:   0x2fd06b,
  blue:    0x6fb5ff,
  magenta: 0xff3d97,
};

const REGION_TONE = {
  frontal:    'red',
  parietal:   'orange',
  occipital:  'yellow',
  temporal:   'green',
  cerebellum: 'blue',
  brainstem:  'magenta',
};

// Anatomical names shown in the hint pill when a region is hovered.
const REGION_LABEL = {
  frontal:    'frontal lobe',
  parietal:   'parietal lobe',
  occipital:  'occipital lobe',
  temporal:   'temporal lobe',
  cerebellum: 'cerebellum',
  brainstem:  'brainstem',
};
const HINT_BASE = 'human cortex · fsaverage pial · drag to rotate';

function initResearch3D(canvas) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parent = canvas.parentElement;

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
  // Camera straight on — any non-zero Y here makes the brain read as tilted
  // because lookAt then pitches the view slightly downward.
  camera.position.set(0, 0, 4.0);

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x111122, 0.55));

  // Hierarchy: `spin` rotates around its local Y axis, which equals the
  // world Y axis since spin has no other rotations. That makes the user-
  // controlled rotation a true turntable in horizontal screen space. The
  // inner `orient` group does the fsaverage→Three.js axis fix-up so the
  // brain stands top-up with the face toward the camera.
  const spin = new THREE.Group();
  scene.add(spin);
  const orient = new THREE.Group();
  // fsaverage uses RAS (+X right, +Y anterior, +Z superior). Three.js wants
  // +Y up and -Z forward. With Euler order 'XYZ' (Three's default), the
  // rotation matrix is Rx·Ry·Rz; we apply Rz first, then Rx. Rz(π) flips
  // X and Y signs; Rx(-π/2) then sends fsaverage Z to world +Y and
  // fsaverage Y to world +Z. Net: top of head at +Y, nose at +Z (visible
  // to a camera at +Z).
  orient.rotation.set(-Math.PI / 2, 0, Math.PI);
  spin.add(orient);

  // region name → { meshes, materials, wireMats, toneColor, baseColor,
  //                  hoverAmount, centroid (local), label (DOM) }
  const regions = {};
  const pickables = [];

  // Light grey body with a dark wireframe — wireframe carries the gyri /
  // sulci read, body gives it weight.
  const baseMatTemplate = new THREE.MeshBasicMaterial({
    color: 0xd6dce5,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const wireMatTemplate = new THREE.LineBasicMaterial({
    color: 0x1a2030,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });

  function regionNameFor(obj) {
    let cur = obj;
    while (cur) {
      const n = (cur.name || '').toLowerCase();
      for (const key of Object.keys(REGION_TONE)) {
        if (n.includes(key)) return key;
      }
      cur = cur.parent;
    }
    return null;
  }

  // ---- Load the GLB ------------------------------------------------------
  const loader = new GLTFLoader();
  loader.load(
    'assets/connectome.glb?v=3',
    (gltf) => {
      const root = gltf.scene;
      const wireGroup = new THREE.Group();

      root.traverse((obj) => {
        if (!obj.isMesh) return;
        const region = regionNameFor(obj);
        const mat = baseMatTemplate.clone();
        obj.material = mat;
        obj.frustumCulled = true;
        obj.userData.region = region;
        pickables.push(obj);

        const wireMat = wireMatTemplate.clone();
        const wf = new THREE.LineSegments(
          new THREE.WireframeGeometry(obj.geometry),
          wireMat,
        );
        wf.position.copy(obj.position);
        wf.rotation.copy(obj.rotation);
        wf.scale.copy(obj.scale);
        wireGroup.add(wf);

        if (region) {
          if (!regions[region]) {
            regions[region] = {
              meshes: [],
              materials: [],
              wireMats: [],
              toneColor: new THREE.Color(TONE_HEX[REGION_TONE[region]]),
              baseColor: new THREE.Color(0xd6dce5),
              hoverAmount: 0,
              centroid: null,
              label: document.querySelector(`.brain-anchor[data-anchor="${region}"]`),
            };
          }
          regions[region].meshes.push(obj);
          regions[region].materials.push(mat);
          regions[region].wireMats.push(wireMat);
        }
      });
      orient.add(root);
      orient.add(wireGroup);

      // World-space bounds of the oriented brain.
      spin.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(spin);
      const c = box.getCenter(new THREE.Vector3());
      // Shift the inner orient group so the brain's center sits on spin's
      // origin. That makes spin's Y axis (the rotation axis) pass through
      // the middle of the brain — a true turntable.
      orient.position.sub(c);
      spin.updateMatrixWorld(true);

      const size = box.getSize(new THREE.Vector3()).length();
      camera.position.z = size * 1.75;
      camera.near = size / 100;
      camera.far = size * 100;
      camera.updateProjectionMatrix();

      // Region centroids in spin-LOCAL coords. orient.matrixWorld already
      // includes the recentering, and spin is identity right now, so world
      // coords ≡ spin-local coords at this instant. Stored once; rotated
      // each frame by spin.matrixWorld.
      const tmpV = new THREE.Vector3();
      for (const name of Object.keys(regions)) {
        const r = regions[name];
        const sum = new THREE.Vector3();
        let n = 0;
        for (const m of r.meshes) {
          const pos = m.geometry.attributes.position;
          const step = Math.max(1, Math.floor(pos.count / 1024));
          for (let i = 0; i < pos.count; i += step) {
            tmpV.set(pos.getX(i), pos.getY(i), pos.getZ(i));
            tmpV.applyMatrix4(orient.matrixWorld);
            sum.add(tmpV);
            n++;
          }
        }
        sum.divideScalar(n);
        r.centroid = sum;
      }

      target.rotY = 0;
    },
    undefined,
    (err) => console.warn('Failed to load brain GLB:', err),
  );

  // ---- Post-processing ---------------------------------------------------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Minimal bloom — the grey mesh doesn't need the ghosting glow that the
  // previous white version relied on for visibility.
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.10, 0.6, 0.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- Resize ------------------------------------------------------------
  function resize() {
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(parent);

  // ---- Interaction -------------------------------------------------------
  const drag = { active: false, x: 0, y: 0, moved: 0 };
  const vel = { x: 0 };
  const target = { rotY: 0 };
  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let lastInteract = 0;
  let autoRotateAllowed = true;
  let hoveredRegion = null;

  const hintEl = parent.querySelector('.brain-hint');
  function setHintFor(region) {
    if (!hintEl) return;
    const tail = region ? REGION_LABEL[region] : 'click a region';
    hintEl.textContent = `${HINT_BASE} · ${tail}`;
  }
  setHintFor(null);

  function setDomHover(region) {
    document.querySelectorAll('.brain-anchor').forEach((a) => {
      a.classList.toggle('is-hovered', a.getAttribute('data-anchor') === region);
    });
    setHintFor(region);
  }

  function openInterestFor(region) {
    const anchor = document.querySelector(`.brain-anchor[data-anchor="${region}"]`);
    if (anchor) anchor.click();
  }

  function updateHover(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    let region = null;
    for (const h of hits) {
      const reg = h.object.userData.region;
      if (reg) { region = reg; break; }
    }
    if (region !== hoveredRegion) {
      hoveredRegion = region;
      setDomHover(region);
      canvas.style.cursor = drag.active ? 'grabbing' : (region ? 'pointer' : 'grab');
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    drag.active = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved = 0;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('grabbing');
    canvas.style.cursor = 'grabbing';
    autoRotateAllowed = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag.active) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      // Horizontal-only: only X movement drives rotation (yaw).
      target.rotY += dx * 0.005;
      vel.x = dx * 0.005;
      lastInteract = performance.now();
    } else {
      updateHover(e.clientX, e.clientY);
    }
  });
  function endDrag(e) {
    if (!drag.active) return;
    const wasDrag = drag.moved > 4;
    drag.active = false;
    canvas.classList.remove('grabbing');
    canvas.style.cursor = hoveredRegion ? 'pointer' : 'grab';
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    if (!wasDrag) {
      updateHover(e.clientX, e.clientY);
      if (hoveredRegion) openInterestFor(hoveredRegion);
    }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => {
    if (hoveredRegion) { hoveredRegion = null; setDomHover(null); }
  });

  // ---- Animate -----------------------------------------------------------
  const tmpColor = new THREE.Color();
  const projV = new THREE.Vector3();
  const viewV = new THREE.Vector3();
  const brainCenterWorld = new THREE.Vector3();

  function tick() {
    if (!drag.active) {
      target.rotY += vel.x;
      vel.x *= 0.94;
      if (
        autoRotateAllowed &&
        performance.now() - lastInteract > 1500 &&
        Math.abs(vel.x) < 0.0005
      ) {
        target.rotY += 0.0016;
      }
    }
    spin.rotation.y += (target.rotY - spin.rotation.y) * 0.08;

    camera.lookAt(0, 0, 0);

    // ---- Project region centroids → label screen positions --------------
    // spin is at scene root, no translation, only Y rotation. Centroids
    // are stored in spin-local space — apply spin.matrixWorld to project.
    spin.updateMatrixWorld();
    brainCenterWorld.setFromMatrixPosition(spin.matrixWorld);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (const name of Object.keys(regions)) {
      const r = regions[name];
      if (!r.centroid || !r.label) continue;
      projV.copy(r.centroid).applyMatrix4(spin.matrixWorld);
      // View-space depth for back-face fadeout
      viewV.copy(projV).applyMatrix4(camera.matrixWorldInverse);
      const centerView = brainCenterWorld.clone().applyMatrix4(camera.matrixWorldInverse);
      // Larger (less negative) view.z → further from camera → on the back.
      const depthFrac = (viewV.z - centerView.z); // ≈ -size..+size
      const onBack = depthFrac > 0;
      // Smooth visibility 1 in front → 0 in back over a small band
      const vis = onBack ? Math.max(0, 1 - depthFrac * 1.5) : 1;

      projV.project(camera);
      const x = (projV.x * 0.5 + 0.5) * w;
      const y = (-projV.y * 0.5 + 0.5) * h;
      r.label.style.left = x + 'px';
      r.label.style.top  = y + 'px';
      r.label.style.opacity = vis.toFixed(3);
      r.label.style.pointerEvents = vis < 0.25 ? 'none' : 'auto';
    }

    // ---- Tween per-region hover glow ------------------------------------
    for (const name of Object.keys(regions)) {
      const r = regions[name];
      const targetAmt = (name === hoveredRegion) ? 1 : 0;
      r.hoverAmount += (targetAmt - r.hoverAmount) * 0.12;
      tmpColor.copy(r.baseColor).lerp(r.toneColor, r.hoverAmount);
      // Hover bumps opacity slightly and saturates the tone.
      const opacity     = 0.75 + 0.15 * r.hoverAmount;
      const wireOpacity = 0.70 + 0.20 * r.hoverAmount;
      for (const m of r.materials) {
        m.color.copy(tmpColor);
        m.opacity = opacity;
      }
      for (const wm of r.wireMats) {
        wm.color.copy(tmpColor);
        wm.opacity = wireOpacity;
      }
    }

    composer.render();
    if (!reduceMotion) requestAnimationFrame(tick);
  }
  if (reduceMotion) composer.render();
  else requestAnimationFrame(tick);
}
