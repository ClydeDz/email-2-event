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
      This extension reads the email you have open in Gmail only when you click the Create Event button and then  
      the email content is processed exclusively by Chrome's built-in
      on-device AI (Gemini Nano). Your emails are never stored by this extension. No other data is requested and stored by this extension.
    </p>
  `;

  card.appendChild(body);
  return card;
}
