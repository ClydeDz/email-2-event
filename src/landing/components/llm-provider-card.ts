export function renderLlmProviderCard(_provider: 'builtin'): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';

  const header = document.createElement('div');
  header.className = 'card-header';
  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = 'AI Provider';
  header.appendChild(title);
  card.appendChild(header);

  const radioGroup = document.createElement('div');
  radioGroup.className = 'radio-group';

  // Option 1: Chrome Built-in (enabled)
  radioGroup.appendChild(buildRadioOption({
    id: 'provider-builtin',
    name: 'llm-provider',
    value: 'builtin',
    title: 'Chrome built-in (Gemini Nano)',
    description: 'On-device, private. Processes email locally with no network calls.',
    checked: true,
    disabled: false,
  }));

  // Option 2: Local Ollama (disabled)
  radioGroup.appendChild(buildRadioOption({
    id: 'provider-ollama',
    name: 'llm-provider',
    value: 'ollama',
    title: 'Local Ollama',
    description: 'Run models locally via Ollama on localhost:11434.',
    checked: false,
    disabled: true,
    comingSoon: true,
  }));

  // Option 3: BYO API key (disabled)
  radioGroup.appendChild(buildRadioOption({
    id: 'provider-byok',
    name: 'llm-provider',
    value: 'byok',
    title: 'Bring your own API key',
    description: 'Use Anthropic, OpenAI, or Gemini with your own API key.',
    checked: false,
    disabled: true,
    comingSoon: true,
  }));

  card.appendChild(radioGroup);
  return card;
}

interface RadioOptionConfig {
  id: string;
  name: string;
  value: string;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  comingSoon?: boolean;
}

function buildRadioOption(config: RadioOptionConfig): HTMLElement {
  const label = document.createElement('label');
  label.className = `radio-option ${config.checked ? 'radio-selected' : ''} ${config.disabled ? 'radio-disabled' : ''}`;
  label.htmlFor = config.id;

  const input = document.createElement('input');
  input.type = 'radio';
  input.id = config.id;
  input.name = config.name;
  input.value = config.value;
  input.checked = config.checked;
  input.disabled = config.disabled;

  const content = document.createElement('div');
  content.className = 'radio-option-content';

  const titleEl = document.createElement('div');
  titleEl.className = 'radio-option-title';
  titleEl.textContent = config.title;

  if (config.comingSoon) {
    const badge = document.createElement('span');
    badge.className = 'pill pill-neutral';
    badge.style.fontSize = '11px';
    badge.style.padding = '1px 8px';
    badge.textContent = 'Coming in v1.1';
    titleEl.appendChild(badge);
  }

  const desc = document.createElement('div');
  desc.className = 'radio-option-desc';
  desc.textContent = config.description;

  content.appendChild(titleEl);
  content.appendChild(desc);

  label.appendChild(input);
  label.appendChild(content);

  return label;
}
