import TicketABI from "./abis/Ticket.json";
import EventManagerABI from "./abis/EventManager.json";
import TicketMarketplaceABI from "./abis/TicketMarketplace.json";
import TicketVerifierABI from "./abis/TicketVerifier.json";

export const TICKET_CONTRACT = {
  address: process.env.NEXT_PUBLIC_TICKET_ADDR as `0x${string}`,
  abi: TicketABI,
} as const;

export const EVENT_MGR_CONTRACT = {
  address: process.env.NEXT_PUBLIC_EVENT_MGR_ADDR as `0x${string}`,
  abi: EventManagerABI,
} as const;

export const MARKETPLACE_CONTRACT = {
  address: process.env.NEXT_PUBLIC_MARKETPLACE_ADDR as `0x${string}`,
  abi: TicketMarketplaceABI,
} as const;

export const VERIFIER_CONTRACT = {
  address: process.env.NEXT_PUBLIC_VERIFIER_ADDR as `0x${string}`,
  abi: TicketVerifierABI,
} as const;
