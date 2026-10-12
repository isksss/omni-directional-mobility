import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "omni-directional-mobility",
    compatibilityDate: "2025-04-01",
    domains: ["omni.isksss.dev"],
    observability: {
      enabled: true,
    },
    assets: {
      notFoundHandling: "single-page-application",
    },
  },
});
