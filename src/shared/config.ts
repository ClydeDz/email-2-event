/**
 * Feature flags for the extension.
 * These are configured at build time via environment variables.
 */

// Read from import.meta.env (Vite will inject these from .env)
const ENABLE_TASK_CREATION =
  import.meta.env.VITE_ENABLE_TASK_CREATION === "true";

export const featureFlags = {
  enableTaskCreation: ENABLE_TASK_CREATION,
} as const;

export type FeatureFlags = typeof featureFlags;
