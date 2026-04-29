"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { UserPlus, Loader2, Users, Crown } from "lucide-react";
import { signupAction } from "@/lib/auth-actions";
import type { AuthFormState, Role } from "@/lib/definitions";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signupAction,
    undefined,
  );
  const [role, setRole] = useState<Role>("FAN");

  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="name" className="cc-label">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          className="cc-input"
          placeholder="Jane Doe"
        />
        {state?.errors?.name && (
          <p className="cc-error">{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="cc-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="cc-input"
          placeholder="you@example.com"
        />
        {state?.errors?.email && (
          <p className="cc-error">{state.errors.email[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="cc-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="cc-input"
          placeholder="At least 8 characters"
        />
        {state?.errors?.password && (
          <ul className="mt-1 space-y-0.5">
            {state.errors.password.map((e) => (
              <li key={e} className="cc-error">
                • {e}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <span className="cc-label">I am a</span>
        <input type="hidden" name="role" value={role} />
        <div className="grid grid-cols-2 gap-3">
          <RoleCard
            active={role === "FAN"}
            onClick={() => setRole("FAN")}
            icon={<Users className="w-5 h-5" />}
            label="Fan"
            sub="Buy & resell tickets"
          />
          <RoleCard
            active={role === "EVENT_MANAGER"}
            onClick={() => setRole("EVENT_MANAGER")}
            icon={<Crown className="w-5 h-5" />}
            label="Event Manager"
            sub="Create events"
          />
        </div>
        {state?.errors?.role && (
          <p className="cc-error">{state.errors.role[0]}</p>
        )}
      </div>

      {state?.message && <p className="cc-error">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="cc-btn cc-btn-primary w-full"
      >
        {pending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <UserPlus className="w-4 h-4" />
        )}
        {pending ? "Creating account..." : "Create account"}
      </button>

      <p
        className="text-sm text-center"
        style={{ color: "var(--cc-text-muted)" }}
      >
        Already have an account?{" "}
        <Link href="/signin" className="cc-link">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function RoleCard({
  active,
  onClick,
  icon,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-3 rounded-xl transition"
      style={{
        border: `1px solid ${active ? "var(--cc-neon)" : "var(--cc-border)"}`,
        background: active ? "rgba(176, 38, 255, 0.08)" : "transparent",
        boxShadow: active ? "var(--cc-neon-glow)" : "none",
      }}
    >
      <div
        className="flex items-center gap-2 mb-1"
        style={{ color: active ? "var(--cc-neon-soft)" : "var(--cc-text)" }}
      >
        {icon}
        <span className="font-semibold">{label}</span>
      </div>
      <p className="text-xs" style={{ color: "var(--cc-text-muted)" }}>
        {sub}
      </p>
    </button>
  );
}
