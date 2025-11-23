import { ImageResponse } from "next/og";

export const alt = "agentica";
export const contentType = "image/png";
export const size = {
  width: 1200,
  height: 630,
};
export const revalidate = 604800; // 1 week in seconds

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #6B46C1 0%, #2D1B4E 100%)",
        }}
      >
        {/* NFT Image with border */}
        <div
          style={{
            display: "flex",
            width: "200px",
            height: "200px",
            borderRadius: "12px",
            overflow: "hidden",
            border: "4px solid rgba(255, 255, 255, 0.3)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            marginBottom: "40px",
          }}
        ></div>

        {/* Title and Subtitle */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <h1
            style={{
              fontSize: "84px",
              fontWeight: "700",
              color: "#ffffff",
              textAlign: "center",
              letterSpacing: "-2px",
              textShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              margin: 0,
            }}
          >
            agentica
          </h1>
          <p
            style={{
              fontSize: "36px",
              fontWeight: "400",
              color: "rgba(255, 255, 255, 0.9)",
              textAlign: "center",
              margin: 0,
            }}
          >
            the wallet that helps you sleep better
          </p>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
