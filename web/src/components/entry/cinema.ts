import * as THREE from "three";
import { isSoftwareRendererName } from "./entry-state";
import { createLogoParts } from "./cinema-geometry";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { markSource, wordSource } from "./logo-sources";

const clamp = THREE.MathUtils.clamp;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function createCinema(
  host: HTMLElement,
  getState: () => { start: number; duration: number },
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  if (!context) throw new Error("WebGL unavailable; use the vector fallback.");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x080b0b, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  // Software rasterizers make the PMREM environment pass pathologically
  // slow: its deferred cost blocks the main thread past the intro exit
  // timer, so the intro overstays its scheduled duration. Skipping the
  // environment map there keeps the intro on schedule; the scene lights
  // still shade the metal. Hardware renderers keep the full environment.
  const rendererName = (() => {
    try {
      const info = context.getExtension("WEBGL_debug_renderer_info");
      return info
        ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL))
        : "";
    } catch {
      return "";
    }
  })();
  const softwareRenderer = isSoftwareRendererName(rendererName);
  const pmrem = softwareRenderer ? null : new THREE.PMREMGenerator(renderer);
  const room = softwareRenderer ? null : new RoomEnvironment();
  const env = pmrem && room ? pmrem.fromScene(room, 0.04) : null;
  if (env) scene.environment = env.texture;
  room?.dispose();
  pmrem?.dispose();
  const root = new THREE.Group();
  scene.add(root);
  const resources: (THREE.BufferGeometry | THREE.Material)[] = [];
  const metal = new THREE.MeshStandardMaterial({
    color: 0xbc7950,
    metalness: 0.94,
    roughness: 0.24,
    envMapIntensity: 1.55,
  });
  const letters = new THREE.MeshStandardMaterial({
    color: 0xd4a582,
    metalness: 0.88,
    roughness: 0.28,
    envMapIntensity: 1.45,
  });
  const edge = new THREE.LineBasicMaterial({
    color: 0xefad78,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
  });
  resources.push(metal, letters, edge);
  function extrude(
    source: string,
    depth: number,
    bevel: number,
    scale: number,
    centerX: number,
    centerY: number,
    material: THREE.Material,
  ) {
    const group = new THREE.Group();
    for (const geometry of createLogoParts(source, {
      depth,
      bevel,
      centerX,
      centerY,
    })) {
      resources.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(scale, -scale, scale);
      mesh.userData.offset = new THREE.Vector3(
        (group.children.length % 2 ? 1 : -1) * 0.55,
        ((group.children.length % 3) - 1) * 0.45,
        0.25 + (group.children.length % 3) * 0.12,
      );
      group.add(mesh);
    }
    return group;
  }
  const emblem = extrude(markSource, 15, 1.7, 0.016, 141.5, 142, metal);
  emblem.position.y = 0.85;
  root.add(emblem);
  const word = extrude(wordSource, 5, 0.55, 0.014, 256.5, 65, letters);
  word.position.set(0, -2.2, 0.02);
  root.add(word);
  const outlines = new THREE.Group();
  root.add(outlines);
  for (const mesh of emblem.children as THREE.Mesh[]) {
    const g = new THREE.EdgesGeometry(mesh.geometry, 35);
    resources.push(g);
    const l = new THREE.LineSegments(g, edge);
    l.scale.copy(mesh.scale);
    outlines.add(l);
  }
  outlines.position.copy(emblem.position);
  const key = new THREE.DirectionalLight(0xffedd9, 5);
  key.position.set(-4, 6, 8);
  scene.add(key);
  const cool = new THREE.DirectionalLight(0xb9d1ce, 2);
  cool.position.set(6, 1, 3);
  scene.add(cool);
  const sweep = new THREE.PointLight(0xffb26f, 42, 25, 2);
  sweep.position.set(-6, 1, 5);
  scene.add(sweep);
  scene.add(new THREE.AmbientLight(0xc4d4cf, 0.6));
  const circuits = new THREE.Group();
  scene.add(circuits);
  const lines: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[] = [];
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? -1 : 1;
    const y = ((i % 9) - 4) * 0.68;
    const pts = [
      new THREE.Vector3(side * 13, y * 1.8, -2.5),
      new THREE.Vector3(side * 6.2, y * 1.8, -2.5),
      new THREE.Vector3(side * 4.6, y, -2.5),
      new THREE.Vector3(side * 2.6, y, -2.5),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setDrawRange(0, 0);
    resources.push(geo);
    const mat = new THREE.LineBasicMaterial({
      color: 0xc78658,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });
    resources.push(mat);
    const line = new THREE.Line(geo, mat);
    circuits.add(line);
    lines.push(line);
    const dotGeo = new THREE.SphereGeometry(0.025, 6, 4);
    resources.push(dotGeo);
    const dot = new THREE.Mesh(
      dotGeo,
      new THREE.MeshBasicMaterial({ color: 0xffbf82 }),
    );
    resources.push(dot.material);
    dot.position.copy(pts[pts.length - 1]);
    circuits.add(dot);
  }
  let width = 0,
    height = 0,
    frame = 0,
    last = 0,
    dead = false;
  const resize = () => {
    const box = host.getBoundingClientRect();
    width = box.width;
    height = box.height;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const draw = (now: number) => {
    if (dead) return;
    frame = requestAnimationFrame(draw);
    if (now - last < 1000 / 40 || document.hidden) return;
    last = now;
    const { start, duration } = getState();
    const p = clamp((now - start) / duration, 0, 1);
    const mobile = width < 700;
    const assemble = smooth(0.03, 0.42, p),
      wordIn = smooth(0.28, 0.56, p),
      approach = smooth(0, 0.64, p),
      exit = smooth(0.8, 1, p);
    const fit = Math.max(
      9.6,
      4.4 / (Math.tan(THREE.MathUtils.degToRad(18)) * camera.aspect),
    );
    camera.position.set(
      0.7 * (1 - approach),
      0.35,
      THREE.MathUtils.lerp(fit * 2.5, fit * 0.92, approach) * (1 - exit * 0.53),
    );
    camera.lookAt(0, -0.15, 0);
    root.rotation.set(
      0.1 * (1 - approach) + 0.025,
      -0.45 * (1 - approach) + 0.08 - Math.sin(p * Math.PI) * 0.045,
      0,
    );
    emblem.scale.setScalar(mobile ? 1.25 : 1.05);
    emblem.position.y = mobile ? 1.15 : 0.8;
    emblem.children.forEach((mesh, i) => {
      mesh.position.copy(mesh.userData.offset).multiplyScalar(1 - assemble);
      mesh.position.z += (1 - assemble) * (i * 0.035);
      mesh.visible = p > 0.02;
    });
    word.scale.setScalar(wordIn);
    word.position.y = mobile ? -2.3 : -2.2;
    metal.emissive.setHex(0x8a370e);
    metal.emissiveIntensity = (1 - assemble) * 0.35;
    letters.emissive.setHex(0x7d360d);
    letters.emissiveIntensity = (1 - wordIn) * 0.4;
    outlines.visible = p < 0.65;
    edge.opacity = (1 - smooth(0.3, 0.65, p)) * 0.8;
    outlines.scale.copy(emblem.scale);
    outlines.position.copy(emblem.position);
    lines.forEach((line, i) => {
      line.geometry.setDrawRange(
        0,
        Math.ceil(smooth(i * 0.008, 0.22 + i * 0.008, p) * 4),
      );
      line.material.opacity = (0.15 + Math.sin(p * 10 + i) * 0.08) * (1 - exit);
    });
    sweep.position.x = THREE.MathUtils.lerp(-7, 7, smooth(0.35, 0.82, p));
    sweep.intensity = 35 + Math.sin(p * Math.PI) * 30;
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(draw);
  const lost = (e: Event) => {
    e.preventDefault();
    dead = true;
    cancelAnimationFrame(frame);
    host.dispatchEvent(new Event("cinema-unavailable"));
  };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  return () => {
    dead = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    renderer.domElement.removeEventListener("webglcontextlost", lost);
    resources.forEach((r) => r.dispose());
    env?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
