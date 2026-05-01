"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Wallet } from "lucide-react";

export function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const wrongNetwork = isConnected && chain?.id !== sepolia.id;

  if (wrongNetwork) {
    return (
      <button
        onClick={() => switchChain({ chainId: sepolia.id })}
        className="cc-btn cc-btn-ghost !px-3 !py-2 text-red-400 border-red-400"
      >
        Wrong network — switch to Sepolia
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="cc-btn cc-btn-ghost !px-3 !py-2"
        title="Click to disconnect"
      >
        <Wallet className="w-4 h-4" style={{ color: "var(--cc-neon-soft)" }} />
        <span className="hidden sm:inline font-mono text-xs">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
      </button>
    );
  }

  const injector = connectors[0];
  return (
    <button
      onClick={() => connect({ connector: injector })}
      disabled={isPending}
      className="cc-btn cc-btn-primary !px-3 !py-2"
    >
      <Wallet className="w-4 h-4" />
      <span className="hidden sm:inline">
        {isPending ? "Connecting…" : "Connect Wallet"}
      </span>
    </button>
  );
}
