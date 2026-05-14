export function renderPrivacyCard(): HTMLElement {
  const card = document.createElement("div");
  card.className = "card";

  const header = document.createElement("div");
  header.className = "card-header";
  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = "Privacy & data";
  header.appendChild(title);
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "privacy-text";

  body.innerHTML = `
    <p>
      This extension reads the email you have open in Gmail — only when you click one of the
      two action buttons. The email content is processed exclusively by Chrome's built-in
      on-device AI (Gemini Nano). Nothing is sent to any external server.
    </p>
    <p>
      Your Google account is used only to create Tasks you explicitly save. The extension
      requests the <code>tasks</code> scope, <code>openid</code>, <code>profile</code>,
      and <code>email</code> scopes — nothing else.
      No Gmail API scopes are requested; the extension reads your email from the DOM, not
      via the Gmail API.
    </p> 
    <p>
      Email content stays on your device. No inference servers. No data collection. Your emails are never stored by this extension.
    </p>
      
  `;

  card.appendChild(body);
  return card;
}
