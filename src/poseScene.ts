/**
 * 3-D handstand pose viewer (LIFT-DM8). A procedural three.js "mannequin" you can
 * orbit (drag to rotate the view), posed from the variation vector — lean tilts
 * the body, range-of-motion raises the hands on a block / parallettes, and the
 * wall orientation (back / front / ladder / free) places the wall and faces the
 * figure. No external model asset: the body is built from capsule/sphere meshes,
 * so it stays self-contained.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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

const SKIN = 0xd8b48c;
const OUTLINE = 0x6f6150;

/** cm string ("+15cm", "-10cm", "0cm") → metres (0.15, −0.10, 0). */
function cm(v: string | undefined): number {
  const m = /(-?\d+(?:\.\d+)?)\s*cm/.exec(v ?? "");
  return m ? parseFloat(m[1]!) / 100 : 0;
}

export function mountPoseScene(container: HTMLElement, initial: PoseVec): PoseScene {
  const H = 300;
  const W = () => Math.max(220, Math.round(container.clientWidth || 280));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W(), H);
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, W() / H, 0.1, 100);
  camera.position.set(2.4, 1.2, 3.2);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.05, 0);
  controls.enablePan = false;
  controls.minDistance = 2.2;
  controls.maxDistance = 8;
  controls.enableDamping = true;
  controls.update();

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(3, 6, 4);
  scene.add(dir);

  const disposables: { dispose(): void }[] = [];
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: OUTLINE, roughness: 0.9 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcdd6df, roughness: 1, side: THREE.DoubleSide });
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x9fb0c3, roughness: 0.9 });
  disposables.push(skinMat, darkMat, wallMat, blockMat);

  // Floor.
  const floorGeo = new THREE.CircleGeometry(3.2, 48);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  disposables.push(floorGeo, floor.material as THREE.Material);

  // Wall (on −X, the lean direction) + ladder rungs — shown per orientation.
  const wallGeo = new THREE.PlaneGeometry(3.4, 2.8);
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(-0.95, 1.4, 0);
  wall.rotation.y = Math.PI / 2;
  scene.add(wall);
  disposables.push(wallGeo);
  const rungs = new THREE.Group();
  const rungGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8);
  disposables.push(rungGeo);
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(rungGeo, blockMat);
    r.rotation.x = Math.PI / 2; // horizontal, spanning Z
    r.position.set(-0.93, 0.5 + i * 0.32, 0);
    rungs.add(r);
  }
  scene.add(rungs);

  // ---- Figure: root (rises with the block) → lean pivot at the hands (y=0) ----
  const root = new THREE.Group();
  scene.add(root);
  const lean = new THREE.Group(); // rotates about Z (hands pivot) for forward lean
  root.add(lean);
  const facing = new THREE.Group(); // rotates about Y so the chest faces / backs the wall
  lean.add(facing);

  const capsule = (len: number, rad: number, y: number, x = 0): THREE.Mesh => {
    const g = new THREE.CapsuleGeometry(rad, len, 6, 14);
    disposables.push(g);
    const m = new THREE.Mesh(g, skinMat);
    m.position.set(x, y, 0);
    return m;
  };
  // arms: hands (y=0) up to shoulders (~0.6)
  facing.add(capsule(0.5, 0.055, 0.3, -0.14));
  facing.add(capsule(0.5, 0.055, 0.3, 0.14));
  // torso: shoulders (~0.6) → hips (~1.15)
  facing.add(capsule(0.42, 0.135, 0.9));
  // head: hangs down between the arms (below shoulders, toward the hands)
  const headGeo = new THREE.SphereGeometry(0.135, 18, 14);
  disposables.push(headGeo);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 0.46, 0);
  facing.add(head);
  const noseGeo = new THREE.SphereGeometry(0.045, 8, 6);
  disposables.push(noseGeo);
  const nose = new THREE.Mesh(noseGeo, darkMat);
  nose.position.set(0.12, 0.45, 0); // points +X = the chest/face direction
  facing.add(nose);
  // legs: hips (~1.15) → feet (~2.05)
  facing.add(capsule(0.74, 0.075, 1.55, -0.09));
  facing.add(capsule(0.74, 0.075, 1.55, 0.09));
  // hands on the floor
  const handGeo = new THREE.SphereGeometry(0.06, 10, 8);
  disposables.push(handGeo);
  for (const x of [-0.14, 0.14]) {
    const h = new THREE.Mesh(handGeo, skinMat);
    h.position.set(x, 0, 0);
    facing.add(h);
  }

  // Block / parallettes under the hands (shown for non-zero ROM).
  const blockGroup = new THREE.Group();
  root.add(blockGroup);

  function setBlock(romM: number) {
    blockGroup.clear();
    if (Math.abs(romM) < 0.005) return;
    if (romM > 0) {
      // raised hands on a solid block (shorter range — easier)
      const g = new THREE.BoxGeometry(0.5, romM, 0.5);
      disposables.push(g);
      const b = new THREE.Mesh(g, blockMat);
      b.position.set(0, romM / 2, 0);
      blockGroup.add(b);
    } else {
      // deficit on parallettes (deeper — harder): two posts under the hands
      const h = -romM;
      const g = new THREE.BoxGeometry(0.12, h, 0.12);
      disposables.push(g);
      for (const x of [-0.14, 0.14]) {
        const p = new THREE.Mesh(g, blockMat);
        p.position.set(x, h / 2, 0);
        blockGroup.add(p);
      }
    }
  }

  function update(vec: PoseVec): void {
    const support = vec.support ?? "free";
    const isLadder = support === "ladder" || support.startsWith("lad");
    const onWall = support !== "free";
    const frontToWall = support === "front_to_wall" || isLadder;
    // ROM: raise the whole figure onto the block; deeper deficit drops below it.
    const romM = cm(vec.rom);
    setBlock(romM);
    root.position.y = Math.max(0, romM);
    // Lean toward the wall (−X). 0cm → vertical; bigger cm → more tilt.
    const leanM = cm(vec.lean);
    lean.rotation.z = leanM * 1.1; // +z tilts the top toward −X (the wall)
    // Face the wall (front-to-wall) or away from it (back-to-wall / free).
    facing.rotation.y = frontToWall ? Math.PI : 0;
    wall.visible = onWall;
    rungs.visible = isLadder;
  }
  update(initial);

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
    update,
    dispose() {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      controls.dispose();
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
