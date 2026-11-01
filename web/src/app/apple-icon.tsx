import { ImageResponse } from "next/og";
import { MARK_PATHS } from "@/components/entry/logo-paths";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS Home Screen artwork. Keep this aligned with the TradeOS entry mark. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#202225", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="126" height="126" viewBox="0 0 283 284" xmlns="http://www.w3.org/2000/svg">
          {MARK_PATHS.map((path, index) => (
            <path key={index} d={path.d} transform={path.transform} fill="#BF7C3B" />
          ))}
        </svg>
      </div>
    ),
    size
  );
}
