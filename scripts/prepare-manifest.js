/**
 * This script generates manifest.json from manifest.json.template by injecting
 * the OAuth client_id from the environment variable.
 *
 * Required both locally and in CI/CD:
 * - Locally: Reads OAUTH_CLIENT_ID from .env file (loaded via dotenv-cli)
 * - CI/CD: Reads OAUTH_CLIENT_ID from GitHub secrets
 *
 * The generated manifest.json is excluded from git via .gitignore to prevent
 * committing sensitive OAuth credentials.
 */

import fs from "fs";
import path from "path";

const templatePath = path.resolve(process.cwd(), "manifest.json.template");
const manifestPath = path.resolve(process.cwd(), "dist/manifest.json");

// Ensure dist directory exists
const distDir = path.resolve(process.cwd(), "dist");
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

let manifestContent = fs.readFileSync(templatePath, "utf-8");

// Replace OAuth client_id from environment variable
const oauthClientId = process.env.OAUTH_CLIENT_ID;
if (!oauthClientId) {
  console.error("Error: OAUTH_CLIENT_ID environment variable is not set");
  process.exit(1);
}

manifestContent = manifestContent.replace(/\$OAUTH_CLIENT_ID/g, oauthClientId);

// Conditionally include OAuth scopes based on VITE_ENABLE_TASK_CREATION flag
const enableTaskCreation = process.env.VITE_ENABLE_TASK_CREATION === "true";
if (!enableTaskCreation) {
  // Remove the entire oauth2 section when task creation is disabled
  manifestContent = manifestContent.replace(/,\s*"oauth2":\s*\{[^}]*\}/g, "");
}

fs.writeFileSync(manifestPath, manifestContent);
console.log("manifest.json generated successfully");
