import { defineConfig } from 'astro/config';

export default defineConfig({
  experimental: {
    csp: {
      algorithm: "SHA-512",
      // fonts, images, and connections
      directives: [
        "default-src 'self'",
        "connect-src 'self' https://flutevision-api-2aeac29f3245.herokuapp.com http://localhost:8000",
        "img-src 'self' data: blob:",
        "font-src 'self' https://fonts.gstatic.com"
      ],
      // how scripts and styles are loaded
      scriptDirective: {
        resources: [
          "'self'", // keeping local scripts
          "https://cdn.jsdelivr.net", // allow CDN JS,
          "https://www.googletagmanager.com" // analytics
        ]
      },
      styleDirective: {
        resources: [
          "'self'",
          "https://fonts.googleapis.com"
        ]
      }
    }
  }
});
