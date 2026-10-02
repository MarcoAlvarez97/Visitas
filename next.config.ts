import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

// "standalone" solo sirve para correr el servidor por tu cuenta (bun run start).
// En Vercel se usa el output estándar de Next.js, por eso se omite ahí.
if (!process.env.VERCEL) {
  nextConfig.output = "standalone";
}

export default nextConfig;
