import { defineConfig } from 'astro/config';

export default defineConfig({
  experimental: {
    csp: {
      algorithm: "SHA-512",
      // fonts, images, and connections
      directives: [
        "default-src 'self'",
        "connect-src 'self' https://flutevision-api-2aeac29f3245.herokuapp.com http://localhost:8000 https://www.google-analytics.com https://cdn.jsdelivr.net",
        "img-src 'self' data: blob: https://www.googletagmanager.com",
        "font-src 'self' https://fonts.gstatic.com"
      ],
      // how scripts and styles are loaded
      scriptDirective: {
        resources: [
          "'self'", // keeping local scripts
          // Note, mediapipe hands wont work (only for the frontend hand overline) on a remote instance without "unsafe-eval", however I am not enabling that bc of XSS risk. If someone wants to try that though and is using my code as a learning reference, refer to this GitHub issue thread: https://github.com/google-ai-edge/mediapipe/issues/4028
          "https://cdn.jsdelivr.net", // allow CDN JS,
          "https://www.googletagmanager.com", // analytics
          "https://www.google-analytics.com"
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
