"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { signinAction } from "@/lib/auth-actions";
import type { AuthFormState } from "@/lib/definitions";

export function SigninForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signinAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-4" noValidate>
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
          autoComplete="current-password"
          required
          className="cc-input"
          placeholder="••••••••"
        />
        {state?.errors?.password && (
          <p className="cc-error">{state.errors.password[0]}</p>
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
          <LogIn className="w-4 h-4" />
        )}
        {pending ? "Signing in..." : "Sign in"}
      </button>

      <p
        className="text-sm text-center"
        style={{ color: "var(--cc-text-muted)" }}
      >
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="cc-link">
          Create one
        </Link>
      </p>
    </form>
  );
}
