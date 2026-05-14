export async function getAuthToken(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError?.message ?? 'Auth failed');
      } else {
        resolve(token);
      }
    });
  });
}

export async function removeAuthToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

export async function signOut(): Promise<void> {
  try {
    const token = await getAuthToken(false);
    await removeAuthToken(token);
  } catch {
    // already signed out
  }
  await chrome.storage.local.remove(['profile', 'taskLists', 'defaultTaskListId']);
}
