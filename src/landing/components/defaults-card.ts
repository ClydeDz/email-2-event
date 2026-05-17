import type { DashboardState, TaskList } from "../../shared/types";
import { featureFlags } from "../../shared/config";

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

export function renderDefaultsCard(
  defaults: DashboardState["defaults"],
  profile: DashboardState["profile"],
): HTMLElement {
  const card = document.createElement("div");
  card.className = "card";

  const header = document.createElement("div");
  header.className = "card-header";
  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = "Defaults";
  header.appendChild(title);
  card.appendChild(header);

  const isSignedIn = !!profile;

  // ── Task list selector ──
  if (featureFlags.enableTaskCreation) {
    const listGroup = document.createElement("div");
    listGroup.className = "form-group";

    const listLabel = document.createElement("label");
    listLabel.className = "form-label";
    listLabel.htmlFor = "default-task-list";
    listLabel.textContent = "Default task list";

    const listSelect = document.createElement("select");
    listSelect.className = "form-select";
    listSelect.id = "default-task-list";
    listSelect.disabled = !isSignedIn;

    if (!isSignedIn) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Sign in to see your task lists";
      listSelect.appendChild(opt);
    } else {
      const defaultOpt = document.createElement("option");
      defaultOpt.value = "@default";
      defaultOpt.textContent = "My Tasks (default)";
      listSelect.appendChild(defaultOpt);
    }

    const listHelper = document.createElement("div");
    listHelper.className = "form-helper";
    listHelper.textContent = "Tasks will be added to this list by default.";

    listGroup.appendChild(listLabel);
    listGroup.appendChild(listSelect);
    listGroup.appendChild(listHelper);
    card.appendChild(listGroup);

    // Load task lists if signed in
    if (isSignedIn) {
      sendMessage<{ taskLists: TaskList[] }>({ type: "GET_TASK_LISTS" })
        .then(({ taskLists }) => {
          listSelect.innerHTML = "";
          for (const list of taskLists) {
            const opt = document.createElement("option");
            opt.value = list.id;
            opt.textContent = list.title;
            if (list.id === defaults.taskListId) opt.selected = true;
            listSelect.appendChild(opt);
          }
        })
        .catch(() => {
          // Keep default option
        });

      listSelect.addEventListener("change", async () => {
        const newListId = listSelect.value;
        const selectedOption = listSelect.options[listSelect.selectedIndex];
        await chrome.storage.local.set({
          defaultTaskListId: newListId,
          defaults: {
            ...defaults,
            taskListId: newListId,
            taskListName: selectedOption.textContent ?? "",
          },
        });
      });
    }
  }

  // ── Event duration ──
  const durationGroup = document.createElement("div");
  durationGroup.className = "form-group";

  const durationLabel = document.createElement("label");
  durationLabel.className = "form-label";
  durationLabel.textContent = "Default event duration";

  const durationButtons = document.createElement("div");
  durationButtons.className = "duration-group";

  const durations: Array<30 | 60 | 90> = [30, 60, 90];
  for (const mins of durations) {
    const btn = document.createElement("button");
    btn.className = `duration-btn ${defaults.eventDurationMins === mins ? "active" : ""}`;
    btn.textContent = mins === 90 ? "90 min" : `${mins} min`;
    btn.addEventListener("click", async () => {
      durationButtons
        .querySelectorAll(".duration-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      await chrome.storage.local.set({
        defaults: { ...defaults, eventDurationMins: mins },
      });
    });
    durationButtons.appendChild(btn);
  }

  const durationHelper = document.createElement("div");
  durationHelper.className = "form-helper";
  durationHelper.textContent =
    "Used when the email does not specify an end time.";

  durationGroup.appendChild(durationLabel);
  durationGroup.appendChild(durationButtons);
  durationGroup.appendChild(durationHelper);
  card.appendChild(durationGroup);

  // ── Timezone ──
  const tzGroup = document.createElement("div");
  tzGroup.className = "form-group";

  const tzLabel = document.createElement("label");
  tzLabel.className = "form-label";
  tzLabel.htmlFor = "timezone-input";
  tzLabel.textContent = "Timezone";

  const tzWrapper = document.createElement("div");
  tzWrapper.className = "tz-autocomplete";

  const tzInput = document.createElement("input");
  tzInput.type = "text";
  tzInput.className = "form-input";
  tzInput.id = "timezone-input";
  tzInput.value =
    defaults.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  tzInput.placeholder = "e.g. Europe/London";
  tzInput.autocomplete = "off";
  tzInput.setAttribute("spellcheck", "false");
  tzInput.setAttribute("role", "combobox");
  tzInput.setAttribute("aria-autocomplete", "list");
  tzInput.setAttribute("aria-expanded", "false");

  const tzMenu = document.createElement("ul");
  tzMenu.className = "tz-menu";
  tzMenu.setAttribute("role", "listbox");
  tzMenu.hidden = true;

  tzWrapper.appendChild(tzInput);
  tzWrapper.appendChild(tzMenu);

  const timezones = getSupportedTimezones();
  const validTimezones = new Set(timezones);

  const tzHelper = document.createElement("div");
  tzHelper.className = "form-helper";
  const defaultHelperText =
    "Auto-detected from your browser. Type to search and override.";
  tzHelper.textContent = defaultHelperText;

  const MAX_RESULTS = 50;
  let activeIndex = -1;
  let currentResults: string[] = [];

  function filterTimezones(query: string): string[] {
    const q = query.trim().toLowerCase();
    if (!q) return timezones.slice(0, MAX_RESULTS);
    const starts: string[] = [];
    const contains: string[] = [];
    for (const tz of timezones) {
      const lower = tz.toLowerCase();
      if (lower.startsWith(q)) starts.push(tz);
      else if (lower.includes(q)) contains.push(tz);
      if (starts.length >= MAX_RESULTS) break;
    }
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }

  function renderMenu(results: string[]) {
    currentResults = results;
    tzMenu.innerHTML = "";
    if (results.length === 0) {
      tzMenu.hidden = true;
      tzInput.setAttribute("aria-expanded", "false");
      return;
    }
    for (let i = 0; i < results.length; i++) {
      const li = document.createElement("li");
      li.className = "tz-menu-item";
      li.textContent = results[i];
      li.setAttribute("role", "option");
      li.addEventListener("mousedown", (e) => {
        // mousedown so it fires before input blur
        e.preventDefault();
        selectValue(results[i]);
      });
      li.addEventListener("mouseenter", () => setActive(i));
      tzMenu.appendChild(li);
    }
    tzMenu.hidden = false;
    tzInput.setAttribute("aria-expanded", "true");
    setActive(-1);
  }

  function setActive(index: number) {
    activeIndex = index;
    const items = tzMenu.querySelectorAll<HTMLLIElement>(".tz-menu-item");
    items.forEach((el, i) => {
      el.classList.toggle("is-active", i === index);
      if (i === index) el.scrollIntoView({ block: "nearest" });
    });
  }

  async function commitValue(tz: string) {
    if (tz && (validTimezones.has(tz) || isValidTimezone(tz))) {
      tzInput.classList.remove("input-error");
      tzHelper.textContent = defaultHelperText;
      await chrome.storage.local.set({
        defaults: { ...defaults, timezone: tz },
      });
    } else {
      tzInput.classList.add("input-error");
      tzHelper.textContent =
        "Please select a valid IANA timezone (e.g. Europe/London).";
    }
  }

  function selectValue(tz: string) {
    tzInput.value = tz;
    closeMenu();
    void commitValue(tz);
  }

  function closeMenu() {
    tzMenu.hidden = true;
    tzInput.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  }

  tzInput.addEventListener("focus", () => {
    renderMenu(filterTimezones(tzInput.value));
  });

  tzInput.addEventListener("input", () => {
    renderMenu(filterTimezones(tzInput.value));
  });

  tzInput.addEventListener("keydown", (e) => {
    if (tzMenu.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      renderMenu(filterTimezones(tzInput.value));
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, currentResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      if (!tzMenu.hidden && activeIndex >= 0) {
        e.preventDefault();
        selectValue(currentResults[activeIndex]);
      }
    } else if (e.key === "Escape") {
      closeMenu();
    } else if (e.key === "Tab") {
      closeMenu();
    }
  });

  tzInput.addEventListener("blur", () => {
    // Delay so click on menu item can fire
    setTimeout(() => {
      closeMenu();
      void commitValue(tzInput.value.trim());
    }, 100);
  });

  tzGroup.appendChild(tzLabel);
  tzGroup.appendChild(tzWrapper);
  tzGroup.appendChild(tzHelper);
  card.appendChild(tzGroup);

  return card;
}

function getSupportedTimezones(): string[] {
  const intlAny = Intl as unknown as {
    supportedValuesOf?: (key: string) => string[];
  };
  if (typeof intlAny.supportedValuesOf === "function") {
    try {
      return intlAny.supportedValuesOf("timeZone");
    } catch {
      // fall through
    }
  }
  return FALLBACK_TIMEZONES;
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Minimal fallback list for environments without Intl.supportedValuesOf.
// Validation still uses Intl.DateTimeFormat so users may type any valid IANA zone.
const FALLBACK_TIMEZONES: string[] = [
  "UTC",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Anchorage",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Chicago",
  "America/Denver",
  "America/Halifax",
  "America/Lima",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Phoenix",
  "America/Sao_Paulo",
  "America/Santiago",
  "America/Toronto",
  "America/Vancouver",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Jerusalem",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Manila",
  "Asia/Riyadh",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Taipei",
  "Asia/Tehran",
  "Asia/Tokyo",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Bucharest",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Zurich",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Guam",
  "Pacific/Honolulu",
];
