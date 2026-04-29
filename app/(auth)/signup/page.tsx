import { SignupForm } from "./SignupForm";
import { Ticket } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md cc-surface-glow p-8">
        <div className="flex items-center gap-3 mb-6">
          <span
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-[var(--cc-neon)]"
            style={{ boxShadow: "var(--cc-neon-glow)" }}
          >
            <Ticket
              className="w-6 h-6"
              style={{ color: "var(--cc-neon-soft)" }}
            />
          </span>
          <div>
            <h1 className="text-2xl font-bold cc-neon-text">
              Join Concert Chain
            </h1>
            <p className="text-sm" style={{ color: "var(--cc-text-muted)" }}>
              Mint, buy, and resell tickets on-chain.
            </p>
          </div>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
