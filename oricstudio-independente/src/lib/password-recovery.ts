import type { SupabaseClient } from "@supabase/supabase-js";

export function recoveryRedirect(origin: string) {
  return `${new URL(origin).origin}/reset-password`;
}

/** A normal signed-in session is not proof of a password recovery link. */
export function watchPasswordRecovery(
  auth: SupabaseClient["auth"],
  hash: string,
  onState: (state: { validating: boolean; valid: boolean }) => void,
  onRecovery: () => void,
) {
  let active = true;
  let recovery = new URLSearchParams(hash.replace(/^#/, "")).get("type") === "recovery";
  const verify = async () => {
    try {
      const { data, error } = await auth.getUser();
      if (active) onState({ validating: false, valid: recovery && !error && Boolean(data.user) });
    } catch {
      if (active) onState({ validating: false, valid: false });
    }
  };
  const { data } = auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      recovery = true;
      onState({ validating: true, valid: false });
      onRecovery();
      // Do not call Auth methods inside its locked notification callback.
      queueMicrotask(() => { if (active) void verify(); });
    } else if (event === "SIGNED_OUT") {
      recovery = false;
      onState({ validating: false, valid: false });
    }
  });
  if (recovery) void verify();
  else onState({ validating: false, valid: false });
  return () => { active = false; data.subscription.unsubscribe(); };
}