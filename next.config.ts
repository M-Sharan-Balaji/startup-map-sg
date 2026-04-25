import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(new URL(".", import.meta.url)));

const nextConfig: NextConfig = {
  transpilePackages: ["maplibre-gl", "react-map-gl"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
