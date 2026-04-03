import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "../app/login/page";
import Register from "../app/register/page";

const authContext = {
  login: vi.fn(),
};

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../app/context/AuthContext", () => ({
  useAuth: () => authContext,
}));

describe("auth pages", () => {
  beforeEach(() => {
    authContext.login.mockReset();
    vi.restoreAllMocks();
  });

  it("submits login credentials and calls login on success", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 1, first_name: "Alice", last_name: "Adams", email: "alice@example.com" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<Login />);

    const [emailInput, passwordInput] = Array.from(container.querySelectorAll("input")) as HTMLInputElement[];

    await user.type(emailInput, "alice@example.com");
    await user.type(passwordInput, "password123");
    await user.click(screen.getByRole("button", { name: /login now/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("http://localhost:5000/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com", password: "password123" }),
      });
    });

    expect(authContext.login).toHaveBeenCalledWith({
      id: 1,
      first_name: "Alice",
      last_name: "Adams",
      email: "alice@example.com",
    });
  });

  it("prevents registration when passwords do not match", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<Register />);
    const inputs = Array.from(container.querySelectorAll("input")) as HTMLInputElement[];

    await user.type(inputs[0], "Alice");
    await user.type(inputs[1], "Adams");
    await user.type(inputs[2], "alice@example.com");
    await user.type(inputs[3], "password123");
    await user.type(inputs[4], "password321");
    await user.click(inputs[5]);
    await user.click(screen.getByRole("button", { name: /register now/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it("submits registration and logs the new user in", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 2, first_name: "Bob", last_name: "Baker", email: "bob@example.com" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<Register />);
    const inputs = Array.from(container.querySelectorAll("input")) as HTMLInputElement[];

    await user.type(inputs[0], "Bob");
    await user.type(inputs[1], "Baker");
    await user.type(inputs[2], "bob@example.com");
    await user.type(inputs[3], "password456");
    await user.type(inputs[4], "password456");
    await user.click(inputs[5]);
    await user.click(screen.getByRole("button", { name: /register now/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("http://localhost:5000/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: "Bob",
          last_name: "Baker",
          email: "bob@example.com",
          password: "password456",
        }),
      });
    });

    expect(authContext.login).toHaveBeenCalledWith({
      id: 2,
      first_name: "Bob",
      last_name: "Baker",
      email: "bob@example.com",
    });
  });
});