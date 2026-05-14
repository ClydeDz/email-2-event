import type { Extraction } from "../shared/schema";
import type { TaskList } from "../shared/types";
import { normalizeTaskDueDate } from "../shared/date-utils";

const HOST_ID = "gmail-ext-review-modal-host";

function removeExistingHost(): void {
  document.getElementById(HOST_ID)?.remove();
}

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

export function showReviewModal(
  extraction: Extraction,
  taskLists: TaskList[],
): Promise<"saved" | "cancelled"> {
  removeExistingHost();

  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.id = HOST_ID;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });

    // Load modal CSS into shadow DOM
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("src/content/modal.css");
    shadow.appendChild(link);

    // Build modal HTML
    const scrim = document.createElement("div");
    scrim.className = "scrim";

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "modal-title");

    // Header
    const header = document.createElement("div");
    header.className = "modal-header";

    const title = document.createElement("h2");
    title.className = "modal-title";
    title.id = "modal-title";
    title.textContent = "Create Task";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = "&times;";
    header.appendChild(closeBtn);

    // Body
    const body = document.createElement("div");
    body.className = "modal-body";

    // Title field
    const titleField = createField(
      "title-input",
      "Title",
      "input",
      extraction.title,
    );
    body.appendChild(titleField.wrapper);

    // Due date field
    const normalizedDue = normalizeTaskDueDate(extraction);
    const dueField = createField(
      "due-input",
      "Due date",
      "input",
      normalizedDue,
    );
    (dueField.input as HTMLInputElement).type = "date";
    body.appendChild(dueField.wrapper);

    // Notes field
    const notesParts: string[] = [];
    if (extraction.location) {
      notesParts.push(`Location: ${extraction.location}`);
    }
    if (extraction.description) {
      if (notesParts.length > 0) notesParts.push("");
      notesParts.push(`Description: ${extraction.description}`);
    }
    const notesValue = notesParts.join("\n");

    const notesField = createField(
      "notes-input",
      "Notes",
      "textarea",
      notesValue,
    );
    body.appendChild(notesField.wrapper);

    // Task list selector
    const listWrapper = document.createElement("div");
    listWrapper.className = "field";
    const listLabel = document.createElement("label");
    listLabel.setAttribute("for", "list-select");
    listLabel.textContent = "Task list";
    const listSelect = document.createElement("select");
    listSelect.id = "list-select";

    if (taskLists.length === 0) {
      const opt = document.createElement("option");
      opt.value = "@default";
      opt.textContent = "My Tasks";
      listSelect.appendChild(opt);
    } else {
      for (const list of taskLists) {
        const opt = document.createElement("option");
        opt.value = list.id;
        opt.textContent = list.title;
        listSelect.appendChild(opt);
      }
    }

    listWrapper.appendChild(listLabel);
    listWrapper.appendChild(listSelect);
    body.appendChild(listWrapper);

    // Footer
    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-ghost";
    cancelBtn.textContent = "Cancel";

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-primary";
    saveBtn.textContent = "Save task";

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);

    // Assemble
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    scrim.appendChild(modal);
    shadow.appendChild(scrim);

    // Event handlers
    function cleanup(): void {
      removeExistingHost();
    }

    function cancel(): void {
      cleanup();
      resolve("cancelled");
    }

    cancelBtn.addEventListener("click", cancel);
    closeBtn.addEventListener("click", cancel);

    // Click on scrim (outside modal) cancels
    scrim.addEventListener("click", (e) => {
      if (e.target === scrim) cancel();
    });

    // Escape key cancels
    const handleKeydown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", handleKeydown);
        cancel();
      }
    };
    document.addEventListener("keydown", handleKeydown);

    saveBtn.addEventListener("click", async () => {
      const taskTitle = (titleField.input as HTMLInputElement).value.trim();
      const due =
        (dueField.input as HTMLInputElement).value.trim() || undefined;
      const notes =
        (notesField.input as HTMLTextAreaElement).value.trim() || undefined;
      const listId = listSelect.value;

      if (!taskTitle) {
        (titleField.input as HTMLInputElement).focus();
        return;
      }

      // Loading state
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner"></span> Saving…';

      try {
        await sendMessage({
          type: "CREATE_TASK",
          payload: { title: taskTitle, due, notes, listId },
        });

        // Mark tile done
        try {
          await sendMessage({
            type: "MARK_TILE_DONE",
            payload: { tileId: "create-task" },
          });
        } catch {
          // non-fatal
        }

        cleanup();
        showToast(shadow, "Task created ✓", "success");
        // Wait a moment for toast to be visible before resolving
        setTimeout(() => resolve("saved"), 1500);
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save task";
        showToast(shadow, `Error: ${(err as Error).message}`, "error");
      }
    });
  });
}

function createField(
  id: string,
  labelText: string,
  type: "input" | "textarea",
  value: string,
): { wrapper: HTMLElement; input: HTMLInputElement | HTMLTextAreaElement } {
  const wrapper = document.createElement("div");
  wrapper.className = "field";

  const label = document.createElement("label");
  label.setAttribute("for", id);
  label.textContent = labelText;

  const input =
    type === "textarea"
      ? document.createElement("textarea")
      : document.createElement("input");

  input.id = id;
  if (type === "textarea") {
    (input as HTMLTextAreaElement).value = value;
  } else {
    (input as HTMLInputElement).value = value;
  }

  wrapper.appendChild(label);
  wrapper.appendChild(input);

  return { wrapper, input };
}

function showToast(
  root: ShadowRoot,
  message: string,
  type: "success" | "error",
): void {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  root.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 300ms";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
