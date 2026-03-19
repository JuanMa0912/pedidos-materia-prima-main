import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // 🚫 Ignora errores de lint
  },
  typescript: {
    ignoreBuildErrors: true,  // 🚫 Ignora errores de TS
  },
  experimental: {
    turbo: {}, // Opcional: asegura compatibilidad con Turbopack
  },
};

export default nextConfig;
