import { ImageResponse } from "next/og";
import { MARK_PATHS } from "@/components/entry/logo-paths";

/** Shared, deterministic TradeOS mark artwork for installable-app icons.
 * The maskable icon has no master-package variant: this route renders the
 * canonical mark geometry (MARK_PATHS, verified against the master package
 * by brand-source.test.ts) at safe-zone scale on the package charcoal field.
 * The 192/512 "any" icons come straight from the package (web/public/brand). */
export function renderInstallIcon(size: 192 | 512, maskable = false) {
  const markSize = Math.round(size * (maskable ? 0.55 : 0.7));
  return new ImageResponse(
    (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", backgroundColor: "#222426" }}>
        <svg width={markSize} height={markSize} viewBox="0 0 283 284" xmlns="http://www.w3.org/2000/svg">
          {MARK_PATHS.map((path, index) => (
            <path key={index} d={path.d} transform={path.transform} fill="#C98460" />
          ))}
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
