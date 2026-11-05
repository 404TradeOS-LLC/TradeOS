import { ExtrudeGeometry } from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
// The supplied vectors remain the authority for both the 3D model and fallback.
export function createLogoParts(
  source: string,
  {
    depth,
    bevel,
    centerX,
    centerY,
  }: { depth: number; bevel: number; centerX: number; centerY: number },
) {
  const parts = [];
  for (const path of new SVGLoader().parse(source).paths) {
    for (const shape of path.toShapes()) {
      const geometry = new ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: bevel,
        bevelThickness: bevel,
        curveSegments: 12,
      });
      geometry.translate(-centerX, -centerY, -depth / 2);
      parts.push(geometry);
    }
  }
  return parts;
}
