import type { PlayerResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export async function fetchPlayer(tag: string): Promise<PlayerResponse> {
  const response = await fetch(
    `${API_BASE}/api/player?tag=${encodeURIComponent(tag)}`,
  );

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // Keep fallback message when the server response is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<PlayerResponse>;
}
