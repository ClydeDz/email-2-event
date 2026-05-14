import "./install";
import { getAuthToken, signOut } from "./google/auth";
import { getCachedProfile, fetchAndCacheProfile } from "./google/userinfo";
import { createTask, getTaskLists } from "./google/tasks";
import { buildCalendarTemplateUrl } from "./google/calendar-url";
import { runExtraction, checkAvailability } from "./llm";
import type { Extraction } from "../shared/schema";
import type { EmailData } from "../content/extract";
import type { DashboardState, TaskList } from "../shared/types";

// Open dashboard when the toolbar icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/landing/dashboard.html"),
  });
});

// Message router
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => {
      console.error("[service-worker] Message handler error:", err);
      sendResponse({ error: String(err?.message ?? err) });
    });
  return true; // keep channel open for async response
});

async function handleMessage(message: {
  type: string;
  payload?: unknown;
}): Promise<unknown> {
  switch (message.type) {
    case "SIGN_IN": {
      const profile = await fetchAndCacheProfile();
      // Also pre-fetch task lists and cache them
      try {
        const token = await getAuthToken(false);
        const lists = await getTaskLists(token);
        await chrome.storage.local.set({ taskLists: lists });
        if (lists.length > 0) {
          const existing = await chrome.storage.local.get("defaultTaskListId");
          if (!existing.defaultTaskListId) {
            await chrome.storage.local.set({ defaultTaskListId: lists[0].id });
          }
        }
      } catch {
        // non-fatal, task lists can be fetched later
      }
      return { profile };
    }

    case "SIGN_OUT": {
      await signOut();
      return { ok: true };
    }

    case "GET_PROFILE": {
      const profile = await getCachedProfile();
      return { profile };
    }

    case "GET_TASK_LISTS": {
      // Try cached first
      const cached = await chrome.storage.local.get("taskLists");
      if (cached.taskLists) {
        return { taskLists: cached.taskLists as TaskList[] };
      }
      // Fetch fresh
      try {
        const token = await getAuthToken(false);
        const lists = await getTaskLists(token);
        await chrome.storage.local.set({ taskLists: lists });
        return { taskLists: lists };
      } catch {
        return { taskLists: [] };
      }
    }

    case "CREATE_TASK": {
      const payload = message.payload as {
        title: string;
        due?: string;
        notes?: string;
        listId?: string;
      };
      const token = await getAuthToken(false);

      // Determine the target list
      let listId = payload.listId;
      if (!listId) {
        const stored = await chrome.storage.local.get("defaultTaskListId");
        listId = (stored.defaultTaskListId as string) ?? "@default";
      }

      const result = await createTask(token, listId, {
        title: payload.title,
        due: payload.due,
        notes: payload.notes,
      });
      return { task: result };
    }

    case "OPEN_CALENDAR": {
      const extraction = message.payload as Extraction;
      const url = buildCalendarTemplateUrl(extraction);
      await chrome.tabs.create({ url });

      // Mark tile done
      await markTileDone("create-event");

      return { ok: true };
    }

    case "MARK_TILE_DONE": {
      const { tileId } = message.payload as { tileId: string };
      await markTileDone(tileId);
      return { ok: true };
    }

    case "RUN_EXTRACTION": {
      const { emailData, intent } = message.payload as {
        emailData: EmailData;
        intent: "event" | "task";
      };
      const extraction = await runExtraction(emailData, intent);
      return { extraction };
    }

    case "CHECK_AI_AVAILABILITY": {
      const status = await checkAvailability();
      return { status };
    }

    case "GET_DASHBOARD_STATE": {
      return getDashboardState();
    }

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

async function markTileDone(tileId: string): Promise<void> {
  const stored = await chrome.storage.local.get("completedTiles");
  const tiles: string[] = (stored.completedTiles as string[]) ?? [];
  if (!tiles.includes(tileId)) {
    tiles.push(tileId);
    await chrome.storage.local.set({ completedTiles: tiles });
  }
}

async function getDashboardState(): Promise<DashboardState> {
  const stored = await chrome.storage.local.get([
    "profile",
    "completedTiles",
    "llmProvider",
    "defaults",
    "aiStatus",
  ]);

  const defaultDefaults: DashboardState["defaults"] = {
    taskListId: "@default",
    taskListName: "My Tasks",
    eventDurationMins: 30,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  return {
    profile: stored.profile ?? null,
    completedTiles: (stored.completedTiles as string[]) ?? [],
    llmProvider: "builtin",
    defaults:
      (stored.defaults as DashboardState["defaults"]) ?? defaultDefaults,
    aiStatus: (stored.aiStatus as DashboardState["aiStatus"]) ?? "unknown",
  };
}
