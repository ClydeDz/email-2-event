import type { Profile } from '../../shared/types';
import { getAuthToken, removeAuthToken } from './auth';

interface UserInfoResponse {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
  email_verified: boolean;
}

export async function fetchUserInfo(token: string): Promise<Profile> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    await removeAuthToken(token);
    throw new Error('AUTH_REQUIRED');
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.status}`);
  }

  const data: UserInfoResponse = await response.json();

  const profile: Profile = {
    name: data.name,
    email: data.email,
    picture: data.picture,
    givenName: data.given_name,
  };

  return profile;
}

export async function getCachedProfile(): Promise<Profile | null> {
  const result = await chrome.storage.local.get('profile');
  return (result.profile as Profile) ?? null;
}

export async function fetchAndCacheProfile(): Promise<Profile> {
  const token = await getAuthToken(true);
  const profile = await fetchUserInfo(token);
  await chrome.storage.local.set({ profile });
  return profile;
}
