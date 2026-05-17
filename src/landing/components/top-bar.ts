import type { Profile } from "../../shared/types";
import { featureFlags } from "../../shared/config";

function sendMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });
}

export function renderTopBar(profile: Profile | null): void {
  const el = document.getElementById("top-bar");
  if (!el) return;

  const inner = document.createElement("div");
  inner.className = "top-bar-inner";

  // Wordmark
  const wordmark = document.createElement("div");
  wordmark.className = "wordmark";
  wordmark.innerHTML = `
    <img src="../../icons/icon.svg" alt="Email 2 Event" class="wordmark-icon" />
    <span>Email 2 Event</span>
  `;
  inner.appendChild(wordmark);

  // Action buttons container
  const actionsContainer = document.createElement("div");
  actionsContainer.className = "top-bar-actions";
  actionsContainer.style.display = "flex";
  actionsContainer.style.gap = "8px";
  actionsContainer.style.alignItems = "center";

  // Buy me a coffee button
  const coffeeBtn = document.createElement("button");
  coffeeBtn.className = "btn btn-sm btn-primary";
  coffeeBtn.textContent = "Buy me a coffee";
  coffeeBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://ko-fi.com/clydedsouza" });
  });
  actionsContainer.appendChild(coffeeBtn);

  // Subscribe to newsletter button
  const newsletterBtn = document.createElement("button");
  newsletterBtn.className = "btn btn-sm btn-primary";
  newsletterBtn.textContent = "Subscribe to my newsletter";
  newsletterBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://newsletter.clydedsouza.net/" });
  });
  actionsContainer.appendChild(newsletterBtn);

  inner.appendChild(actionsContainer);

  // Identity chip
  const chip = buildIdentityChip(profile);
  inner.appendChild(chip);

  el.innerHTML = "";
  el.appendChild(inner);
}

function buildIdentityChip(profile: Profile | null): HTMLElement {
  const chip = document.createElement("button");
  chip.className = "identity-chip";

  if (profile) {
    // Signed in: avatar only (no name)
    const img = document.createElement("img");
    img.className = "identity-avatar";
    img.src = profile.picture;
    img.alt = profile.name;
    img.width = 32;
    img.height = 32;
    img.onerror = () => {
      img.replaceWith(buildAvatarPlaceholder());
    };

    chip.appendChild(img);

    // Popover
    let popoverEl: HTMLElement | null = null;

    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      if (popoverEl) {
        popoverEl.remove();
        popoverEl = null;
        return;
      }
      popoverEl = buildSignedInPopover(profile, () => {
        popoverEl?.remove();
        popoverEl = null;
      });
      chip.appendChild(popoverEl);

      const dismiss = (ev: MouseEvent): void => {
        if (!chip.contains(ev.target as Node)) {
          popoverEl?.remove();
          popoverEl = null;
          document.removeEventListener("click", dismiss);
        }
      };
      setTimeout(() => document.addEventListener("click", dismiss), 0);
    });
  } else if (featureFlags.enableTaskCreation) {
    // Signed out: Google-compliant sign-in button (only if task creation is enabled)
    chip.className = "google-signin-btn";

    const logo = document.createElement("div");
    logo.className = "google-logo";
    logo.innerHTML = getGoogleLogoSvg();

    const label = document.createElement("span");
    label.textContent = "Sign in with Google";

    chip.appendChild(logo);
    chip.appendChild(label);

    chip.addEventListener("click", async () => {
      chip.disabled = true;
      const originalContent = chip.innerHTML;
      chip.innerHTML = '<span class="spinner"></span> Signing in…';
      try {
        const { profile: newProfile } = await sendMessage<{ profile: Profile }>(
          {
            type: "SIGN_IN",
          },
        );
        // Re-render top bar with the new profile
        renderTopBar(newProfile);
        // Also update onboarding tiles if present
        window.dispatchEvent(
          new CustomEvent("profile-changed", { detail: newProfile }),
        );
      } catch (err) {
        chip.disabled = false;
        chip.innerHTML = originalContent;
        console.error("Sign-in failed:", err);
      }
    });
  } else {
    // Task creation disabled: hide the chip entirely
    chip.style.display = "none";
  }

  return chip;
}

function buildAvatarPlaceholder(): HTMLElement {
  const placeholder = document.createElement("div");
  placeholder.className = "identity-avatar-placeholder";
  placeholder.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  `;
  return placeholder;
}

function getGoogleLogoSvg(): string {
  return `
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" fill-rule="evenodd">
        <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </g>
    </svg>
  `;
}

function buildSignedInPopover(
  profile: Profile,
  onClose: () => void,
): HTMLElement {
  const popover = document.createElement("div");
  popover.className = "identity-popover";

  // Profile row with avatar + name/email
  const profileRow = document.createElement("div");
  profileRow.className = "popover-profile-row";

  const avatar = document.createElement("img");
  avatar.className = "popover-avatar";
  avatar.src = profile.picture;
  avatar.alt = profile.name;
  avatar.width = 40;
  avatar.height = 40;
  avatar.onerror = () => {
    avatar.replaceWith(buildAvatarPlaceholder());
  };

  const textContainer = document.createElement("div");
  textContainer.className = "popover-text";

  const nameEl = document.createElement("div");
  nameEl.className = "popover-name";
  nameEl.textContent = profile.name;

  const emailEl = document.createElement("div");
  emailEl.className = "popover-email";
  emailEl.textContent = profile.email;

  textContainer.appendChild(nameEl);
  textContainer.appendChild(emailEl);

  profileRow.appendChild(avatar);
  profileRow.appendChild(textContainer);

  const divider = document.createElement("hr");
  Object.assign(divider.style, {
    border: "none",
    borderTop: "1px solid #e3e8ee",
    margin: "12px 0",
  });

  const signOutBtn = document.createElement("button");
  signOutBtn.className = "btn btn-ghost btn-sm popover-signout-btn";
  signOutBtn.textContent = "Sign out";

  signOutBtn.addEventListener("click", async () => {
    try {
      await sendMessage({ type: "SIGN_OUT" });
      onClose();
      renderTopBar(null);
      window.dispatchEvent(
        new CustomEvent("profile-changed", { detail: null }),
      );
    } catch (err) {
      console.error("Sign-out failed:", err);
    }
  });

  popover.appendChild(profileRow);
  popover.appendChild(divider);
  popover.appendChild(signOutBtn);

  return popover;
}
