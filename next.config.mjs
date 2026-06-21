/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/tw",
        destination:
          "/?utm_source=twitter&utm_medium=profile&utm_campaign=launch",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

