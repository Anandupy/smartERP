import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The offline admission-form reader runs native/Node-only code (ONNX
  // Runtime, sharp, canvas, pdf.js) in the `/api/admissions/ocr` route
  // handler; load them from node_modules at runtime rather than bundling.
  serverExternalPackages: [
    "onnxruntime-node",
    "sharp",
    "@napi-rs/canvas",
    "pdfjs-dist",
  ],
};

export default nextConfig;
