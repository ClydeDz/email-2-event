import type { DashboardState, Profile } from "../../shared/types";

// Declare LanguageModel global
declare const LanguageModel: {
  availability(options?: {
    expectedOutputLanguages?: string[];
  }): Promise<string>;
  create(options: {
    monitor?: (monitor: EventTarget) => void;
    expectedOutputLanguages?: string[];
  }): Promise<unknown>;
};

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

export function renderOnboardingTiles(state: DashboardState): void {
  const section = document.getElementById("onboarding");
  if (!section) return;

  section.innerHTML = "";

  const header = document.createElement("div");
  header.className = "section-header section-header-row";

  const headerText = document.createElement("div");
  headerText.className = "section-header-text";
  headerText.innerHTML = `
    <h2>Get started <span class="section-counter" data-counter></span></h2>
    <p>Complete these steps to get the most out of the extension.</p>
  `;
  header.appendChild(headerText);

  const controls = document.createElement("div");
  controls.className = "carousel-controls";
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "carousel-btn";
  prevBtn.setAttribute("aria-label", "Previous tile");
  prevBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "carousel-btn";
  nextBtn.setAttribute("aria-label", "Next tile");
  nextBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
  controls.appendChild(prevBtn);
  controls.appendChild(nextBtn);
  header.appendChild(controls);

  section.appendChild(header);

  // Show unavailable AI banner if needed
  if (state.aiStatus === "unavailable") {
    const banner = document.createElement("div");
    banner.className = "ai-unavailable-banner";
    banner.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>On-device AI is not available on this device. Gemini Nano requires compatible hardware and Chrome 138+. BYO API key support is coming in v1.1.</span>
    `;
    section.appendChild(banner);
  }

  const grid = document.createElement("div");
  grid.className = "tiles-grid";
  section.appendChild(grid);

  const isSignedIn = !!state.profile;
  const completedTiles = state.completedTiles;

  // Tile 1: Create an event
  grid.appendChild(
    buildTile({
      id: "create-event",
      icon: calendarIcon(),
      title: "Create an event from Gmail",
      body: "Open any email in Gmail and click <em>+ Create event</em> in the message toolbar.",
      done: completedTiles.includes("create-event"),
      locked: false,
      actions: [
        {
          label: "Open Gmail",
          primary: true,
          onClick: () => {
            chrome.tabs.create({ url: "https://mail.google.com/" });
          },
        },
      ],
    }),
  );

  // Tile 2: Review on Chrome Web Store
  grid.appendChild(
    buildTile({
      id: "leave-review",
      icon: starIcon(),
      title: "Review us on the Chrome Web Store",
      body: "Enjoying the extension? A quick review helps other users discover it.",
      done: completedTiles.includes("leave-review"),
      locked: false,
      actions: [
        {
          label: "Leave a review",
          primary: true,
          onClick: async () => {
            const reviewUrl = `https://chrome.google.com/webstore/detail/${chrome.runtime.id}/reviews`;
            chrome.tabs.create({ url: reviewUrl });
            const updated = Array.from(
              new Set([...completedTiles, "leave-review"]),
            );
            await chrome.storage.local.set({ completedTiles: updated });
            renderOnboardingTiles({ ...state, completedTiles: updated });
          },
        },
      ],
    }),
  );

  // Tile 3: Sign in
  const tile2Done = isSignedIn || completedTiles.includes("sign-in");
  grid.appendChild(
    buildTile({
      id: "sign-in",
      icon: userIcon(),
      title: "Sign in with Google",
      body: "Connect your account to create Google Tasks from emails.",
      done: tile2Done,
      locked: false,
      actions: tile2Done
        ? []
        : [
            {
              label: "Sign in",
              primary: true,
              onClick: async (btn) => {
                btn.disabled = true;
                btn.textContent = "Signing in…";
                try {
                  const { profile } = await sendMessage<{ profile: Profile }>({
                    type: "SIGN_IN",
                  });
                  window.dispatchEvent(
                    new CustomEvent("profile-changed", { detail: profile }),
                  );
                  // Re-render tiles
                  renderOnboardingTiles({
                    ...state,
                    profile,
                    completedTiles: [...completedTiles, "sign-in"],
                  });
                } catch (err) {
                  btn.disabled = false;
                  btn.textContent = "Sign in";
                  console.error("Sign-in failed:", err);
                }
              },
            },
          ],
    }),
  );

  // Tile 3: Create a task (gated on tile 2)
  grid.appendChild(
    buildTile({
      id: "create-task",
      icon: checkIcon(),
      title: "Create a task from Gmail",
      body: "Try the Tasks button on an invoice or reminder email.",
      done: completedTiles.includes("create-task"),
      locked: !tile2Done,
      lockedReason: "Sign in first to unlock Tasks",
      actions: [
        {
          label: "Open Gmail",
          primary: true,
          onClick: () => {
            chrome.tabs.create({ url: "https://mail.google.com/" });
          },
        },
      ],
    }),
  );

  // Tile 4: Download AI model (only if downloadable)
  // TEMPORARY: Mark as done for preview
  if (state.aiStatus === "downloadable" || true) {
    grid.appendChild(buildDownloadModelTile(true));
  }

  wireCarouselControls(grid, prevBtn, nextBtn, headerText);
}

function wireCarouselControls(
  grid: HTMLElement,
  prevBtn: HTMLButtonElement,
  nextBtn: HTMLButtonElement,
  headerText: HTMLElement,
): void {
  const counterEl = headerText.querySelector<HTMLElement>("[data-counter]");
  const tiles = Array.from(grid.children) as HTMLElement[];
  const total = tiles.length;
  const completed = tiles.filter((t) =>
    t.classList.contains("tile-done"),
  ).length;
  if (counterEl) counterEl.textContent = `${completed}/${total}`;

  function getCurrentIndex(): number {
    const scrollLeft = grid.scrollLeft;
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < tiles.length; i++) {
      const dist = Math.abs(tiles[i].offsetLeft - grid.offsetLeft - scrollLeft);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    return closest;
  }

  function updateState(): void {
    const atStart = grid.scrollLeft <= 1;
    const atEnd = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 1;
    prevBtn.disabled = atStart;
    nextBtn.disabled = atEnd;
  }

  function scrollByOne(direction: 1 | -1): void {
    const idx = getCurrentIndex();
    const target = tiles[Math.max(0, Math.min(total - 1, idx + direction))];
    if (target) {
      grid.scrollTo({
        left: target.offsetLeft - grid.offsetLeft,
        behavior: "smooth",
      });
    }
  }

  prevBtn.addEventListener("click", () => scrollByOne(-1));
  nextBtn.addEventListener("click", () => scrollByOne(1));
  grid.addEventListener("scroll", updateState, { passive: true });
  window.addEventListener("resize", updateState);

  updateState();
}

interface TileConfig {
  id: string;
  icon: string;
  title: string;
  body: string;
  done: boolean;
  locked: boolean;
  lockedReason?: string;
  actions?: Array<{
    label: string;
    primary: boolean;
    onClick: (btn: HTMLButtonElement) => void;
  }>;
}

function buildTile(config: TileConfig): HTMLElement {
  const tile = document.createElement("div");
  tile.className = `tile ${config.done ? "tile-done" : ""} ${config.locked ? "tile-locked" : ""}`;
  tile.setAttribute("data-tile-id", config.id);

  // Icon
  const iconEl = document.createElement("div");
  iconEl.className = `tile-icon ${config.done ? "done" : ""}`;
  iconEl.innerHTML = config.icon;
  tile.appendChild(iconEl);

  // Done badge
  if (config.done) {
    const badge = document.createElement("div");
    badge.className = "tile-badge";
    badge.innerHTML = '<span class="pill pill-success">Done</span>';
    tile.appendChild(badge);
  }

  // Lock icon
  if (config.locked) {
    const lockIcon = document.createElement("div");
    lockIcon.className = "tile-lock-icon";
    lockIcon.title = config.lockedReason ?? "Locked";
    lockIcon.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    `;
    tile.appendChild(lockIcon);
  }

  // Title
  const titleEl = document.createElement("div");
  titleEl.className = "tile-title";
  titleEl.textContent = config.title;
  tile.appendChild(titleEl);

  // Body
  const bodyEl = document.createElement("div");
  bodyEl.className = "tile-body";
  bodyEl.innerHTML = config.body;
  tile.appendChild(bodyEl);

  // Locked reason
  if (config.locked && config.lockedReason) {
    const lockedReasonEl = document.createElement("div");
    lockedReasonEl.className = "tile-locked-reason";
    lockedReasonEl.textContent = config.lockedReason;
    tile.appendChild(lockedReasonEl);
  }

  // Actions
  if (!config.locked && config.actions && config.actions.length > 0) {
    const actionsEl = document.createElement("div");
    actionsEl.style.display = "flex";
    actionsEl.style.gap = "8px";
    actionsEl.style.marginTop = "4px";

    for (const action of config.actions) {
      const btn = document.createElement("button");
      btn.className = `btn btn-sm ${action.primary ? "btn-primary" : "btn-secondary"}`;
      btn.textContent = action.label;
      btn.addEventListener("click", () => action.onClick(btn));
      actionsEl.appendChild(btn);
    }

    tile.appendChild(actionsEl);
  }

  return tile;
}

function buildDownloadModelTile(done: boolean = false): HTMLElement {
  const tile = document.createElement("div");
  tile.className = `tile ${done ? "tile-done" : ""}`;
  tile.setAttribute("data-tile-id", "download-ai");

  const iconEl = document.createElement("div");
  iconEl.className = `tile-icon ${done ? "done" : ""}`;
  iconEl.innerHTML = cpuIcon();
  tile.appendChild(iconEl);

  // Done badge
  if (done) {
    const badge = document.createElement("div");
    badge.className = "tile-badge";
    badge.innerHTML = '<span class="pill pill-success">Done</span>';
    tile.appendChild(badge);
  }

  const titleEl = document.createElement("div");
  titleEl.className = "tile-title";
  titleEl.textContent = "Enable on-device AI";
  tile.appendChild(titleEl);

  const bodyEl = document.createElement("div");
  bodyEl.className = "tile-body";
  bodyEl.textContent =
    "Download Gemini Nano (~2 GB) so extraction runs privately on this device.";
  tile.appendChild(bodyEl);

  // Progress bar (hidden initially but takes up space)
  const progressWrapper = document.createElement("div");
  progressWrapper.style.visibility = "hidden";
  progressWrapper.style.height = "40px";
  const progressBar = document.createElement("div");
  progressBar.className = "progress-bar";
  const progressFill = document.createElement("div");
  progressFill.className = "progress-fill";
  progressFill.style.width = "0%";
  progressBar.appendChild(progressFill);
  progressWrapper.appendChild(progressBar);
  const progressLabel = document.createElement("div");
  progressLabel.style.fontSize = "12px";
  progressLabel.style.color = "#697386";
  progressLabel.style.marginTop = "4px";
  progressWrapper.appendChild(progressLabel);
  tile.appendChild(progressWrapper);

  // Only show download actions if not done
  if (!done) {
    const actionsEl = document.createElement("div");
    actionsEl.style.marginTop = "4px";
    actionsEl.style.display = "flex";
    actionsEl.style.gap = "8px";

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "btn btn-sm btn-primary";
    downloadBtn.textContent = "Download model";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-sm btn-ghost";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.display = "none";

    let abortController: AbortController | null = null;

    cancelBtn.addEventListener("click", () => {
      if (abortController) {
        abortController.abort();
        downloadBtn.disabled = false;
        downloadBtn.textContent = "Download model";
        cancelBtn.style.display = "none";
        progressWrapper.style.visibility = "hidden";
        progressLabel.textContent = "";
        progressFill.style.width = "0%";
      }
    });

    downloadBtn.addEventListener("click", async () => {
      if (typeof LanguageModel === "undefined") {
        alert("Gemini Nano is not available in this browser version.");
        return;
      }

      downloadBtn.disabled = true;
      downloadBtn.innerHTML =
        '<span class="spinner spinner-white"></span> Starting…';
      progressWrapper.style.visibility = "visible";
      cancelBtn.style.display = "inline-flex";
      abortController = new AbortController();

      try {
        await LanguageModel.create({
          expectedOutputLanguages: ["en"],
          monitor: (monitor: EventTarget) => {
            monitor.addEventListener("downloadprogress", (e: Event) => {
              const evt = e as CustomEvent<{ loaded?: number; total?: number }>;
              const loaded = evt.detail?.loaded ?? 0;
              const total = evt.detail?.total ?? 0;
              const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
              progressFill.style.width = `${pct}%`;
              progressLabel.textContent = `Downloading… ${pct}%`;
              if (pct >= 100) {
                progressLabel.textContent = "Download complete!";
                downloadBtn.textContent = "Downloaded ✓";
                cancelBtn.style.display = "none";
                // Refresh to show updated status
                setTimeout(() => window.location.reload(), 1500);
              }
            });
          },
        });
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") {
          console.log("Download cancelled by user");
        } else {
          downloadBtn.disabled = false;
          downloadBtn.textContent = "Download model";
          cancelBtn.style.display = "none";
          progressWrapper.style.visibility = "hidden";
          console.error("Model download failed:", err);
          alert("Download failed. Please try again.");
        }
      }
    });

    actionsEl.appendChild(downloadBtn);
    actionsEl.appendChild(cancelBtn);
    tile.appendChild(actionsEl);
  }

  return tile;
}

// ── Inline SVG icons ──
function calendarIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>`;
}

function userIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>`;
}

function starIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>`;
}

function checkIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;
}

function checkCircleIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>`;
}

function cpuIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
    <rect x="9" y="9" width="6" height="6"/>
    <line x1="9" y1="1" x2="9" y2="4"/>
    <line x1="15" y1="1" x2="15" y2="4"/>
    <line x1="9" y1="20" x2="9" y2="23"/>
    <line x1="15" y1="20" x2="15" y2="23"/>
    <line x1="20" y1="9" x2="23" y2="9"/>
    <line x1="20" y1="14" x2="23" y2="14"/>
    <line x1="1" y1="9" x2="4" y2="9"/>
    <line x1="1" y1="14" x2="4" y2="14"/>
  </svg>`;
}
