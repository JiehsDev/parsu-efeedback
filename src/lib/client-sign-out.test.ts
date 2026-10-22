import { afterEach, expect, it, vi } from "vitest";
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("./client-fetch", () => ({
  clientDataCache: { clear: vi.fn() },
  clearClientDataOnLogout: vi.fn(),
}));
import { signOut } from "next-auth/react";
import { clientDataCache, clearClientDataOnLogout } from "./client-fetch";
import { signOutWithCacheReset } from "./client-sign-out";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("clears private memory immediately, then broadcasts and redirects only after sign-out completes", async () => {
  let complete!: () => void;
  vi.mocked(signOut).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = () => resolve({ url: "/login" });
      }),
  );
  const assign = vi.fn();
  vi.stubGlobal("window", { location: { assign } });
  const pending = signOutWithCacheReset();
  expect(clientDataCache.clear).toHaveBeenCalledOnce();
  expect(clearClientDataOnLogout).not.toHaveBeenCalled();
  expect(assign).not.toHaveBeenCalled();
  complete();
  await pending;
  expect(clearClientDataOnLogout).toHaveBeenCalledOnce();
  expect(assign).toHaveBeenCalledWith("/login");
});

it("does not announce completed sign-out when the session-removal request fails", async () => {
  vi.mocked(signOut).mockRejectedValueOnce(new Error("Offline"));
  const assign = vi.fn();
  vi.stubGlobal("window", { location: { assign } });
  await expect(signOutWithCacheReset()).rejects.toThrow("Offline");
  expect(clientDataCache.clear).toHaveBeenCalledOnce();
  expect(clearClientDataOnLogout).not.toHaveBeenCalled();
  expect(assign).not.toHaveBeenCalled();
});
