import type { MetadataRoute } from "next";

/**
 * background_color and theme_color are --color-canvas and --color-accent
 * from app/globals.css, kept in sync with that file rather than guessed.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GoHybrid",
    short_name: "GoHybrid",
    description:
      "A training hub for hybrid athletes — build workouts, plan your week, and track progress across running, strength and HYROX.",
    start_url: "/",
    display: "standalone",
    background_color: "#010102",
    theme_color: "#5e6ad2",
  };
}
