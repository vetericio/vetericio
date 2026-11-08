import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, it, expect, vi } from "vitest";
import { recoveryRedirect, watchPasswordRecovery } from "@/lib/password-recovery";

function authMock() {
  let listener: (event: string) => void = () => {};
  const unsubscribe = vi.fn();
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  const auth = {
    getUser,
    onAuthStateChange: vi.fn((callback: typeof listener) => {
      listener = callback;
      return { data: { subscription: { unsubscribe } } };
    }),
  };
  return { auth: auth as unknown as SupabaseClient["auth"], getUser, unsubscribe, emit: (event: string) => listener(event) };
}

describe("Password recovery", () => {
  it("returns the published domain to the public reset page", () => {
    expect(recoveryRedirect("https://gestor-insta-vetericio.lovable.app")).toBe("https://gestor-insta-vetericio.lovable.app/reset-password");
  });
  it("does not accept an ordinary signed-in session as recovery", () => {
    const mock = authMock(); const state = vi.fn();
    const stop = watchPasswordRecovery(mock.auth, "", state, vi.fn());
    mock.emit("SIGNED_IN");
    expect(state).toHaveBeenLastCalledWith({ validating: false, valid: false });
    expect(mock.getUser).not.toHaveBeenCalled(); stop();
  });
  it("accepts a delayed recovery event only after revalidating the user", async () => {
    const mock = authMock(); const state = vi.fn(); const recovery = vi.fn();
    const stop = watchPasswordRecovery(mock.auth, "", state, recovery);
    mock.emit("PASSWORD_RECOVERY");
    expect(state).toHaveBeenLastCalledWith({ validating: true, valid: false });
    await vi.waitFor(() => expect(state).toHaveBeenLastCalledWith({ validating: false, valid: true }));
    expect(mock.getUser).toHaveBeenCalledOnce(); expect(recovery).toHaveBeenCalledOnce(); stop();
  });
  it("rejects expired recovery links", async () => {
    const mock = authMock(); mock.getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    const state = vi.fn(); const stop = watchPasswordRecovery(mock.auth, "#type=recovery", state, vi.fn());
    await vi.waitFor(() => expect(state).toHaveBeenLastCalledWith({ validating: false, valid: false })); stop();
  });
  it("clears recovery authorization on sign out", async () => {
    const mock = authMock(); const state = vi.fn();
    const stop = watchPasswordRecovery(mock.auth, "#type=recovery", state, vi.fn());
    await vi.waitFor(() => expect(state).toHaveBeenLastCalledWith({ validating: false, valid: true }));
    mock.emit("SIGNED_OUT");
    expect(state).toHaveBeenLastCalledWith({ validating: false, valid: false });
    stop(); expect(mock.unsubscribe).toHaveBeenCalledOnce();
  });
});