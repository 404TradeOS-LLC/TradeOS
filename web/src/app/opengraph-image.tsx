import { ImageResponse } from "next/og";
import { MARK_PATHS } from "@/components/entry/logo-paths";

export const alt = "TradeOS — Built for what you build";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ background: "#202225", width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "84px", color: "#f4f2ee", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <svg width="120" height="120" viewBox="0 0 283 284" xmlns="http://www.w3.org/2000/svg">
              {MARK_PATHS.map((path, index) => <path key={index} d={path.d} transform={path.transform} fill="#C98460" />)}
            </svg>
            <div style={{ fontSize: 90, letterSpacing: "-0.055em", fontWeight: 750 }}>TradeOS</div>
          </div>
          <div style={{ height: 5, width: 140, background: "#C98460", marginTop: 48, marginBottom: 24 }} />
          <div style={{ fontSize: 37, fontWeight: 600, letterSpacing: "0.12em" }}>BUILT FOR WHAT YOU BUILD.</div>
          <div style={{ fontSize: 25, marginTop: 24, color: "#C6C6C4" }}>Estimate. Organize. Build.</div>
        </div>
      </div>
    ),
    size
  );
}
