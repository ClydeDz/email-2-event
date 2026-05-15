import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTask, getTaskLists } from "./tasks";

// Mock the auth module
vi.mock("./auth", () => ({
  removeAuthToken: vi.fn(),
}));

import { removeAuthToken } from "./auth";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("createTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a task with title only", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: "task123",
        title: "Test Task",
        selfLink: "https://example.com/task123",
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await createTask("token123", "list123", {
      title: "Test Task",
    });

    expect(result).toEqual({
      id: "task123",
      title: "Test Task",
      selfLink: "https://example.com/task123",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/tasks/v1/lists/list123/tasks",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer token123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Test Task" }),
      }),
    );
  });

  it("creates a task with due date", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: "task123",
        title: "Test Task",
        selfLink: "https://example.com/task123",
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await createTask("token123", "list123", {
      title: "Test Task",
      due: "2026-05-15",
    });

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body.due).toBe("2026-05-15T00:00:00.000Z");
  });

  it("creates a task with notes", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: "task123",
        title: "Test Task",
        selfLink: "https://example.com/task123",
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await createTask("token123", "list123", {
      title: "Test Task",
      notes: "Test notes",
    });

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body.notes).toBe("Test notes");
  });

  it("handles 401 auth error", async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    };
    mockFetch.mockResolvedValue(mockResponse);
    vi.mocked(removeAuthToken).mockResolvedValue(undefined);

    await expect(
      createTask("token123", "list123", { title: "Test Task" }),
    ).rejects.toEqual({
      code: "AUTH_REQUIRED",
    });
    expect(removeAuthToken).toHaveBeenCalledWith("token123");
  });

  it("handles other HTTP errors", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    };
    mockFetch.mockResolvedValue(mockResponse);

    await expect(
      createTask("token123", "list123", { title: "Test Task" }),
    ).rejects.toThrow("Failed to create task: 500 Internal Server Error");
  });
});

describe("getTaskLists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches task lists successfully", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: "list1", title: "Personal" },
          { id: "list2", title: "Work" },
        ],
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await getTaskLists("token123");

    expect(result).toEqual([
      { id: "list1", title: "Personal" },
      { id: "list2", title: "Work" },
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/tasks/v1/users/@me/lists",
      {
        headers: { Authorization: "Bearer token123" },
      },
    );
  });

  it("handles empty items array", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await getTaskLists("token123");

    expect(result).toEqual([]);
  });

  it("handles missing items field", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({}),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await getTaskLists("token123");

    expect(result).toEqual([]);
  });

  it("handles 401 auth error", async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    };
    mockFetch.mockResolvedValue(mockResponse);
    vi.mocked(removeAuthToken).mockResolvedValue(undefined);

    await expect(getTaskLists("token123")).rejects.toEqual({
      code: "AUTH_REQUIRED",
    });
    expect(removeAuthToken).toHaveBeenCalledWith("token123");
  });

  it("handles other HTTP errors", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    };
    mockFetch.mockResolvedValue(mockResponse);

    await expect(getTaskLists("token123")).rejects.toThrow(
      "Failed to fetch task lists: 500",
    );
  });
});
