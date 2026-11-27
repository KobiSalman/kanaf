/** @type {import('next').NextConfig} */
const nextConfig = {
  // הגופנים של תמונת השיתוף נקראים מהדיסק, וצריכים להיכלל בפונקציה ב-Vercel
  experimental: { outputFileTracingIncludes: { '/api/og': ['./app/api/og/*.woff'] } }
};
export default nextConfig;
