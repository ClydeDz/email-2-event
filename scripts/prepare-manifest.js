/**
 * This script generates manifest.json from manifest.template.json by applying
 * environment-specific transformations.
 *
 * Required both locally and in CI/CD:
 * - Locally: Reads OAUTH_CLIENT_ID and VITE_ENABLE_TASK_CREATION from .env file (loaded via dotenv-cli)
 * - CI/CD: Reads OAUTH_CLIENT_ID from GitHub secrets and VITE_ENABLE_TASK_CREATION from GitHub variables
 *
 * The generated manifest.json is excluded from git via .gitignore to prevent
 * committing sensitive OAuth credentials.
 *
 * === MANIFEST TRANSFORMATION RULES ===
 *
 * ALWAYS APPLIED:
 * - Replaces $OAUTH_CLIENT_ID placeholder with actual OAuth client ID from env
 *
 * CONDITIONAL (when VITE_ENABLE_TASK_CREATION=false):
 * - Removes entire "oauth2" section (only needed for OAuth authentication and task creation)
 * - Removes "identity" permission (only needed for OAuth authentication)
 * - Removes "https://www.googleapis.com/*" host permission (only needed for Tasks API and user info)
 *
 * When VITE_ENABLE_TASK_CREATION=true (default for task creation):
 * - All OAuth-related permissions and host permissions remain in manifest
 */

import fs from "fs";
import path from "path";

const templatePath = path.resolve(process.cwd(), "manifest.template.json");
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

// Conditionally remove OAuth-related items when VITE_ENABLE_TASK_CREATION is disabled
const enableTaskCreation = process.env.VITE_ENABLE_TASK_CREATION === "true";
if (!enableTaskCreation) {
  // Remove the entire oauth2 section when task creation is disabled
  manifestContent = manifestContent.replace(/,\s*"oauth2":\s*\{[^}]*\}/g, "");
  // Remove identity permission when task creation is disabled (only needed for OAuth)
  manifestContent = manifestContent.replace(/"identity",\s*/g, "");
  // Remove www.googleapis.com host permission when task creation is disabled (only needed for Tasks API and user info)
  manifestContent = manifestContent.replace(
    /,\s*"https:\/\/www\.googleapis\.com\/\*"/g,
    "",
  );
}

fs.writeFileSync(manifestPath, manifestContent);
console.log("manifest.json generated successfully");
