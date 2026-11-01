import { ImageResponse } from "next/og";
import { MARK_PATHS } from "@/components/entry/logo-paths";

/** Shared, deterministic TradeOS mark artwork for installable-app icons. */
export function renderInstallIcon(size: 192 | 512, maskable = false) {
  const markSize = Math.round(size * (maskable ? 0.55 : 0.7));
  return new ImageResponse(
    (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", backgroundColor: "#202225" }}>
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
