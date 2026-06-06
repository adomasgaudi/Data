/**
 * 3-D handstand pose viewer (LIFT-DM9+). An anatomically real, rigged human
 * (a bundled glTF model) posed into a handstand and shown in three.js — drag to
 * orbit the camera. The variation vector drives it: lean tilts the body, range-
 * of-motion raises the hands onto a block / parallettes, and the wall orientation
 * (back / front / ladder / free) places the wall, ladder rungs and which way the
 * figure faces.
 *
 * The figure is a free, royalty-free Mixamo rig (bundled, base64-inlined by the
 * single-file build). It loads asynchronously; the floor/wall appear instantly
 * and the body pops in once decoded. The handstand is produced by a rig-agnostic
 * poser (aim each limb bone at its child along a target direction, then flip the
 * whole figure upside-down) so it would work with any standard humanoid skeleton.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneRig } from "three/addons/utils/SkeletonUtils.js";
import modelUrl from "./assets/handstand-figure.glb?url";

export interface PoseVec {
  support?: string;
  rom?: string;
  lean?: string;
  [k: string]: string | undefined;
}
export interface PoseScene {
  update(vec: PoseVec): void;
  dispose(): void;
}

/** cm string ("+15cm", "-10cm", "0cm") → metres (0.15, −0.10, 0). */
function cm(v: string | undefined): number {
  const m = /(-?\d+(?:\.\d+)?)\s*cm/.exec(v ?? "");
  return m ? parseFloat(m[1]!) / 100 : 0;
}

/** Find a posed limb bone by its Mixamo name (three.js drops the ":" prefix). */
function bone(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let hit: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!hit && (o as THREE.Bone).isBone && o.name.replace("mixamorig", "") === name) hit = o;
  });
  return hit;
}

/** Rotate `b` so the direction to its child `c` points along (tx,ty,tz) in world
 * space — rig-agnostic limb aiming (works regardless of the bone's rest roll). */
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _qd = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
function aim(b: THREE.Object3D, c: THREE.Object3D, tx: number, ty: number, tz: number): void {
  b.getWorldPosition(_a);
  c.getWorldPosition(_b);
  const cur = _b.clone().sub(_a).normalize();
  const tgt = new THREE.Vector3(tx, ty, tz).normalize();
  _qd.setFromUnitVectors(cur, tgt);
  b.getWorldQuaternion(_qw);
  const qNew = _qd.multiply(_qw);
  b.parent!.getWorldQuaternion(_qp);
  b.quaternion.copy(_qp.invert().multiply(qNew));
  b.updateMatrixWorld(true);
}

/** Bake a straight, vertical handstand into the rig's bones (standing frame:
 * arms straight up, legs straight down) — the upside-down flip is applied later
 * on the wrapper so lean / rom / facing can transform it as a whole. */
function poseHandstand(model: THREE.Object3D): void {
  model.updateMatrixWorld(true);
  const get = (n: string) => bone(model, n);
  const LA = get("LeftArm"), LF = get("LeftForeArm"), LH = get("LeftHand");
  const RA = get("RightArm"), RF = get("RightForeArm"), RH = get("RightHand");
  const LUL = get("LeftUpLeg"), LL = get("LeftLeg"), LFO = get("LeftFoot");
  const RUL = get("RightUpLeg"), RL = get("RightLeg"), RFO = get("RightFoot");
  if (LA && LF && LH) { aim(LA, LF, 0, 1, 0); aim(LF, LH, 0, 1, 0); }
  if (RA && RF && RH) { aim(RA, RF, 0, 1, 0); aim(RF, RH, 0, 1, 0); }
  if (LUL && LL && LFO) { aim(LUL, LL, 0, -1, 0); aim(LL, LFO, 0, -1, 0); }
  if (RUL && RL && RFO) { aim(RUL, RL, 0, -1, 0); aim(RL, RFO, 0, -1, 0); }
}

// Load + pose the figure ONCE; each mount clones the posed rig (cheap) so the
// 3.3 MB model is decoded a single time for the whole session.
let templatePromise: Promise<THREE.Object3D> | null = null;
function loadTemplate(): Promise<THREE.Object3D> {
  if (!templatePromise) {
    templatePromise = new Promise((resolve, reject) => {
      new GLTFLoader().load(
        modelUrl,
        (gltf) => {
          poseHandstand(gltf.scene);
          gltf.scene.updateMatrixWorld(true);
          resolve(gltf.scene);
        },
        undefined,
        reject,
      );
    });
  }
  return templatePromise;
}

export function mountPoseScene(container: HTMLElement, initial: PoseVec): PoseScene {
  const H = 320;
  const W = () => Math.max(220, Math.round(container.clientWidth || 280));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W(), H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W() / H, 0.1, 100);
  camera.position.set(2.6, 1.1, 3.2);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.0, 0);
  controls.enablePan = false;
  controls.minDistance = 2.0;
  controls.maxDistance = 8;
  controls.enableDamping = true;
  controls.update();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 6, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-3, 2, -2);
  scene.add(fill);

  const ownGeo: THREE.BufferGeometry[] = [];
  const ownMat: THREE.Material[] = [];
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x9fb0c3, roughness: 0.9 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcdd6df, roughness: 1, side: THREE.DoubleSide });
  ownMat.push(blockMat, wallMat);

  // Floor.
  const floorGeo = new THREE.CircleGeometry(3.2, 48);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 1 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  ownGeo.push(floorGeo);
  ownMat.push(floorMat);

  // Wall (on −X, the lean direction) + ladder rungs — shown per orientation.
  const wallGeo = new THREE.PlaneGeometry(3.4, 2.8);
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(-0.55, 1.4, 0);
  wall.rotation.y = Math.PI / 2;
  scene.add(wall);
  ownGeo.push(wallGeo);
  const rungs = new THREE.Group();
  const rungGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8);
  ownGeo.push(rungGeo);
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(rungGeo, blockMat);
    r.rotation.x = Math.PI / 2;
    r.position.set(-0.53, 0.4 + i * 0.32, 0);
    rungs.add(r);
  }
  scene.add(rungs);

  // ---- Figure wrapper hierarchy: root (rom lift) → lean (tilt about the hands)
  //      → face (turn toward / away from the wall) → flip (upside-down) → model.
  const root = new THREE.Group();
  const lean = new THREE.Group();
  const face = new THREE.Group();
  const flip = new THREE.Group();
  flip.rotation.x = Math.PI; // invert: a standing figure becomes a handstand
  scene.add(root);
  root.add(lean);
  lean.add(face);
  face.add(flip);

  // Block / parallettes under the hands (shown for non-zero ROM).
  const blockGroup = new THREE.Group();
  root.add(blockGroup);
  function setBlock(romM: number): void {
    blockGroup.clear();
    const h = Math.abs(romM);
    if (h < 0.005) return;
    if (romM > 0) {
      const g = new THREE.BoxGeometry(0.4, h, 0.4);
      ownGeo.push(g);
      const b = new THREE.Mesh(g, blockMat);
      b.position.set(0, h / 2, 0);
      blockGroup.add(b);
    } else {
      const g = new THREE.BoxGeometry(0.08, h, 0.08);
      ownGeo.push(g);
      for (const x of [-0.12, 0.12]) {
        const p = new THREE.Mesh(g, blockMat);
        p.position.set(x, h / 2, 0);
        blockGroup.add(p);
      }
    }
  }

  let cur: PoseVec = { ...initial };
  function apply(): void {
    const support = cur.support ?? "free";
    const isLadder = support === "ladder" || support.startsWith("lad");
    const onWall = support !== "free";
    const frontToWall = support === "front_to_wall" || isLadder;
    const romM = cm(cur.rom);
    setBlock(romM);
    root.position.y = Math.abs(romM); // sit the hands on top of the block / posts
    lean.rotation.z = cm(cur.lean) * 1.1; // tilt the body toward the wall (−X)
    face.rotation.y = frontToWall ? Math.PI : 0; // turn to face / back the wall
    wall.visible = onWall;
    rungs.visible = isLadder;
  }
  apply();

  // Async: drop the posed human in once the model is decoded.
  let disposed = false;
  loadTemplate()
    .then((tpl) => {
      if (disposed) return;
      const model = cloneRig(tpl);
      flip.add(model);
      flip.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      // Raise on the (world-aligned) flip group so the offset isn't itself
      // inverted by flip's π rotation — drop the lowest point (hands) to y=0.
      flip.position.y = -box.min.y;
      apply();
    })
    .catch(() => {
      /* leave the floor/wall scene if the model can't load */
    });

  let raf = 0;
  const loop = () => {
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();

  const onResize = () => {
    renderer.setSize(W(), H);
    camera.aspect = W() / H;
    camera.updateProjectionMatrix();
  };
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
  ro?.observe(container);

  return {
    update(vec: PoseVec) {
      cur = { ...vec };
      apply();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      controls.dispose();
      // Only dispose THIS scene's own resources — the shared model template's
      // geometries/materials stay cached for the next mount.
      for (const g of ownGeo) g.dispose();
      for (const m of ownMat) m.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
