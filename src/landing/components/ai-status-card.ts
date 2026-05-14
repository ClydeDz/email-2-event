export function renderAiStatusCard(
  aiStatus: 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unknown',
  container?: HTMLElement
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'ai-status-card';

  const header = document.createElement('div');
  header.className = 'card-header';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = 'On-device AI';
  header.appendChild(title);

  const pill = buildStatusPill(aiStatus);
  header.appendChild(pill);

  const body = document.createElement('div');
  body.className = 'card-body';
  body.textContent = statusDescription(aiStatus);

  card.appendChild(header);
  card.appendChild(body);

  if (container) {
    container.appendChild(card);
  }

  return card;
}

function buildStatusPill(
  status: 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unknown'
): HTMLElement {
  const pill = document.createElement('span');
  pill.className = `pill ${statusPillClass(status)}`;
  pill.textContent = statusLabel(status);
  return pill;
}

function statusPillClass(status: string): string {
  switch (status) {
    case 'available':   return 'pill-success';
    case 'downloadable': return 'pill-accent';
    case 'downloading': return 'pill-accent';
    case 'unavailable': return 'pill-warning';
    default:            return 'pill-neutral';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'available':   return 'Gemini Nano ready';
    case 'downloadable': return 'Download required';
    case 'downloading': return 'Downloading…';
    case 'unavailable': return 'Not available';
    default:            return 'Checking…';
  }
}

function statusDescription(status: string): string {
  switch (status) {
    case 'available':
      return 'Gemini Nano is installed and ready. Email processing happens entirely on this device — nothing is sent to any server.';
    case 'downloadable':
      return 'Gemini Nano is available for your device but needs to be downloaded first (~2 GB). Use the "Enable on-device AI" tile above to download it.';
    case 'downloading':
      return 'Gemini Nano is currently downloading. Extraction will be available once the download completes.';
    case 'unavailable':
      return 'Gemini Nano is not available on this device. It requires compatible hardware (≥4 GB VRAM or capable iGPU), ~22 GB free disk space, and Chrome 138+. BYO API key support is coming in v1.1.';
    default:
      return 'Checking availability of on-device AI…';
  }
}
