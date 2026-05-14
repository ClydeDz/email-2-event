import { renderTopBar } from "./components/top-bar";
import { renderOnboardingTiles } from "./components/onboarding-tiles";
import { renderAiStatusCard } from "./components/ai-status-card";
import { renderLlmProviderCard } from "./components/llm-provider-card";
import { renderDefaultsCard } from "./components/defaults-card";
import { renderPrivacyCard } from "./components/privacy-card";
import { renderDiagnosticsCard } from "./components/diagnostics-card";
import type { DashboardState } from "../shared/types";

// Declare LanguageModel global
declare const LanguageModel: {
  availability(options?: {
    expectedOutputLanguages?: string[];
  }): Promise<string>;
};

let currentState: DashboardState | null = null;

function sendMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response as T);
      }
    });
  });
}

async function detectAiStatus(): Promise<DashboardState["aiStatus"]> {
  if (typeof LanguageModel === "undefined") return "unavailable";
  try {
    const status = await LanguageModel.availability({
      expectedOutputLanguages: ["en"],
    });
    switch (status) {
      case "available":
        return "available";
      case "downloadable":
        return "downloadable";
      case "downloading":
        return "downloading";
      case "unavailable":
        return "unavailable";
      default:
        return "unknown";
    }
  } catch {
    return "unavailable";
  }
}

function renderSettingsSection(state: DashboardState): void {
  const settings = document.getElementById("settings");
  if (!settings) return;

  settings.innerHTML = "";

  const header = document.createElement("div");
  header.className = "section-header";
  header.innerHTML =
    "<h2>Settings</h2><p>Configure your defaults and AI provider.</p>";
  settings.appendChild(header);

  const cardsGrid = document.createElement("div");
  cardsGrid.style.display = "flex";
  cardsGrid.style.flexDirection = "column";
  cardsGrid.style.gap = "16px";
  settings.appendChild(cardsGrid);

  const aiCard = renderAiStatusCard(state.aiStatus);
  cardsGrid.appendChild(aiCard);

  const providerCard = renderLlmProviderCard(state.llmProvider);
  cardsGrid.appendChild(providerCard);

  const defaultsCard = renderDefaultsCard(state.defaults, state.profile);
  cardsGrid.appendChild(defaultsCard);

  const privacyCard = renderPrivacyCard();
  cardsGrid.appendChild(privacyCard);

  const diagCard = renderDiagnosticsCard();
  cardsGrid.appendChild(diagCard);
}

function renderFooter(): void {
  const footer = document.getElementById("footer");
  if (!footer) return;

  footer.innerHTML = `
    <span>Email → Calendar / Tasks v0.1.0</span>
    <div class="footer-links">
      <a href="https://github.com" target="_blank" rel="noopener">GitHub</a>
      <a href="mailto:support@example.com">Support</a>
    </div>
  `;
}

async function init(): Promise<void> {
  try {
    // Fetch dashboard state from the background service worker
    const state = await sendMessage<DashboardState>({
      type: "GET_DASHBOARD_STATE",
    });

    // Detect real-time AI status (must be done from the page context)
    const aiStatus = await detectAiStatus();
    const fullState: DashboardState = { ...state, aiStatus };

    // Cache AI status in storage so background can return it
    await chrome.storage.local.set({ aiStatus });

    currentState = fullState;

    renderTopBar(fullState.profile);
    renderOnboardingTiles(fullState);
    renderSettingsSection(fullState);
    renderFooter();

    // Subscribe to storage changes
    chrome.storage.onChanged.addListener(handleStorageChange);

    // Listen for profile changes from the top-bar component
    window.addEventListener("profile-changed", (e) => {
      const event = e as CustomEvent;
      if (currentState) {
        currentState = { ...currentState, profile: event.detail };
        renderOnboardingTiles(currentState);
        renderSettingsSection(currentState);
      }
    });
  } catch (err) {
    console.error("[dashboard] Failed to initialize:", err);
    // Show a minimal error state
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #697386; font-family: -apple-system, sans-serif;">
          <p>Failed to load dashboard. Make sure the extension is properly installed.</p>
          <p style="margin-top: 8px; font-size: 12px;">${(err as Error).message}</p>
        </div>
      `;
    }
  }
}

function handleStorageChange(
  changes: { [key: string]: chrome.storage.StorageChange },
  area: string,
): void {
  if (area !== "local") return;
  if (!currentState) return;

  let needsRender = false;

  if (changes.profile) {
    currentState = {
      ...currentState,
      profile: changes.profile.newValue ?? null,
    };
    renderTopBar(currentState.profile);
    needsRender = true;
  }

  if (changes.completedTiles) {
    currentState = {
      ...currentState,
      completedTiles: changes.completedTiles.newValue ?? [],
    };
    needsRender = true;
  }

  if (changes.aiStatus) {
    currentState = {
      ...currentState,
      aiStatus: changes.aiStatus.newValue ?? "unknown",
    };
    needsRender = true;
  }

  if (changes.defaults) {
    currentState = {
      ...currentState,
      defaults: changes.defaults.newValue ?? currentState.defaults,
    };
    needsRender = true;
  }

  if (needsRender) {
    renderOnboardingTiles(currentState);
    renderSettingsSection(currentState);
  }
}

init();
