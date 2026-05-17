/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_TASK_CREATION: string;
  readonly OAUTH_CLIENT_ID: string;
  // Add other environment variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
