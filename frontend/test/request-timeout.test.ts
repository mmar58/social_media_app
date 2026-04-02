import { afterEach, describe, expect, it, vi } from "vitest";

import { requestJson } from "../app/lib/request";

describe("requestJson timeouts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("rejects when a request does not settle before the timeout", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const abortError = new Error("The operation was aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const request = requestJson("http://localhost:5000/api/posts", undefined, {
      retries: 0,
      timeoutMs: 25,
    });

    const assertion = expect(request).rejects.toThrow("Request timed out after 25ms");

    await vi.advanceTimersByTimeAsync(25);

    await assertion;
  });
});