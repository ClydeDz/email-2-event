export function renderDiagnosticsCard(): HTMLElement {
  const details = document.createElement("details");
  details.className = "diagnostics-card";

  const summary = document.createElement("summary");
  summary.textContent = "Diagnostics";
  details.appendChild(summary);

  const body = document.createElement("div");
  body.className = "diagnostics-body";
  body.style.paddingTop = "16px";
  details.appendChild(body);

  // ── AI availability row ──
  const aiRow = document.createElement("div");
  aiRow.className = "diag-row";
  const aiLabel = document.createElement("div");
  aiLabel.className = "diag-label";
  aiLabel.textContent = "AI availability";
  const aiValue = document.createElement("div");
  aiValue.className = "diag-value";
  aiValue.textContent = "checking…";
  aiRow.appendChild(aiLabel);
  aiRow.appendChild(aiValue);
  body.appendChild(aiRow);

  // Check availability via background service worker to avoid direct LanguageModel calls in page context
  chrome.runtime.sendMessage({ type: "CHECK_AI_AVAILABILITY" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      aiValue.textContent = "error";
    } else {
      aiValue.textContent = response.status ?? "error";
    }
  });

  // ── Gmail selector probe ──
  const probeRow = document.createElement("div");
  probeRow.className = "diag-row";
  const probeLabel = document.createElement("div");
  probeLabel.className = "diag-label";
  probeLabel.textContent = "Gmail selector probe";
  const probeBtn = document.createElement("button");
  probeBtn.className = "btn btn-sm btn-secondary";
  probeBtn.textContent = "Run probe";
  const probeResult = document.createElement("div");
  probeResult.className = "diag-value";
  probeResult.style.maxWidth = "360px";
  probeResult.style.wordBreak = "break-word";
  probeResult.style.display = "none";

  probeBtn.addEventListener("click", async () => {
    probeBtn.disabled = true;
    probeBtn.textContent = "Running…";
    probeResult.style.display = "none";

    try {
      // The dashboard is itself a tab, so querying { active: true, currentWindow: true }
      // would return the dashboard tab — not the Gmail tab. Instead, search all windows
      // for any tab whose URL matches mail.google.com.
      const gmailTabs = await chrome.tabs.query({
        url: "https://mail.google.com/*",
      });
      const tab = gmailTabs[0];

      if (!tab?.id) {
        probeResult.style.display = "block";
        probeResult.textContent =
          "No Gmail tab found. Open https://mail.google.com first, then run the probe.";
        return;
      }

      const results = await chrome.tabs.sendMessage(tab.id, {
        type: "SELECTOR_PROBE",
      });
      probeResult.style.display = "block";
      probeResult.textContent = JSON.stringify(results, null, 2);
    } catch (err) {
      probeResult.style.display = "block";
      probeResult.textContent = `Error: ${(err as Error).message}`;
    } finally {
      probeBtn.disabled = false;
      probeBtn.textContent = "Run probe";
    }
  });

  probeRow.appendChild(probeLabel);
  probeRow.appendChild(probeBtn);
  body.appendChild(probeRow);
  body.appendChild(probeResult);

  // ── Test extraction ──
  const testSection = document.createElement("div");
  testSection.style.display = "flex";
  testSection.style.flexDirection = "column";
  testSection.style.gap = "8px";

  const testLabel = document.createElement("div");
  testLabel.className = "form-label";
  testLabel.textContent = "Test extraction — paste an email body";

  const testTextarea = document.createElement("textarea");
  testTextarea.className = "form-textarea";
  testTextarea.placeholder = "Paste an email body here to test extraction…";
  testTextarea.rows = 5;

  const testControls = document.createElement("div");
  testControls.style.display = "flex";
  testControls.style.gap = "8px";

  const testEventBtn = document.createElement("button");
  testEventBtn.className = "btn btn-sm btn-secondary";
  testEventBtn.textContent = "Extract as event";

  const testTaskBtn = document.createElement("button");
  testTaskBtn.className = "btn btn-sm btn-secondary";
  testTaskBtn.textContent = "Extract as task";

  const testResult = document.createElement("pre");
  testResult.className = "diag-value";
  testResult.style.display = "none";
  testResult.style.whiteSpace = "pre-wrap";
  testResult.style.wordBreak = "break-word";
  testResult.style.maxHeight = "200px";
  testResult.style.overflowY = "auto";

  async function runTestExtraction(intent: "event" | "task"): Promise<void> {
    const text = testTextarea.value.trim();
    if (!text) {
      testResult.style.display = "block";
      testResult.textContent = "Please paste some email text first.";
      return;
    }

    testEventBtn.disabled = true;
    testTaskBtn.disabled = true;
    testResult.style.display = "block";
    testResult.textContent = "Extracting…";

    try {
      // Same as the probe: dashboard is the active tab, so query by URL instead.
      const gmailTabs = await chrome.tabs.query({
        url: "https://mail.google.com/*",
      });
      const tab = gmailTabs[0];
      if (!tab?.id) {
        testResult.textContent =
          "Please open a Gmail tab to run extraction (the LanguageModel API is only available in the Gmail content script context).";
        return;
      }

      const result = await chrome.tabs.sendMessage(tab.id, {
        type: "TEST_EXTRACTION",
        payload: {
          subject: "(test)",
          from: "(test)",
          bodyText: text,
          intent,
        },
      });

      testResult.textContent = JSON.stringify(result, null, 2);
    } catch (err) {
      testResult.textContent = `Error: ${(err as Error).message}`;
    } finally {
      testEventBtn.disabled = false;
      testTaskBtn.disabled = false;
    }
  }

  testEventBtn.addEventListener("click", () => runTestExtraction("event"));
  testTaskBtn.addEventListener("click", () => runTestExtraction("task"));

  testControls.appendChild(testEventBtn);
  testControls.appendChild(testTaskBtn);

  testSection.appendChild(testLabel);
  testSection.appendChild(testTextarea);
  testSection.appendChild(testControls);
  testSection.appendChild(testResult);

  body.appendChild(testSection);

  return details;
}
