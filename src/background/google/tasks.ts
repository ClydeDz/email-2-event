import type { TaskList } from '../../shared/types';
import { removeAuthToken } from './auth';

interface CreateTaskParams {
  title: string;
  due?: string;
  notes?: string;
}

interface CreatedTask {
  id: string;
  title: string;
  selfLink: string;
}

interface TaskListsResponse {
  items?: Array<{ id: string; title: string }>;
}

interface TaskResponse {
  id: string;
  title: string;
  selfLink: string;
}

async function handleAuthError(token: string): Promise<never> {
  await removeAuthToken(token);
  throw { code: 'AUTH_REQUIRED' };
}

export async function createTask(
  token: string,
  listId: string,
  params: CreateTaskParams
): Promise<CreatedTask> {
  const body: Record<string, string> = {
    title: params.title,
  };

  if (params.due) {
    // Tasks API requires RFC 3339 format for due date but only uses the date portion
    body['due'] = `${params.due}T00:00:00.000Z`;
  }

  if (params.notes) {
    body['notes'] = params.notes;
  }

  const response = await fetch(
    `https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (response.status === 401) {
    return handleAuthError(token);
  }

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.status} ${response.statusText}`);
  }

  const data: TaskResponse = await response.json();
  return {
    id: data.id,
    title: data.title,
    selfLink: data.selfLink,
  };
}

export async function getTaskLists(token: string): Promise<TaskList[]> {
  const response = await fetch(
    'https://www.googleapis.com/tasks/v1/users/@me/lists',
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (response.status === 401) {
    return handleAuthError(token);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch task lists: ${response.status}`);
  }

  const data: TaskListsResponse = await response.json();
  return (data.items ?? []).map((item) => ({
    id: item.id,
    title: item.title,
  }));
}
