import * as z from "zod";

export type Role = "FAN" | "EVENT_MANAGER";

export const SignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").trim(),
  email: z.string().email("Please enter a valid email.").trim().toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[a-zA-Z]/, "Must contain a letter.")
    .regex(/[0-9]/, "Must contain a number."),
  role: z.enum(["FAN", "EVENT_MANAGER"]),
});

export const SigninSchema = z.object({
  email: z.string().email("Please enter a valid email.").trim().toLowerCase(),
  password: z.string().min(1, "Password is required."),
});

export type AuthFormState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        password?: string[];
        role?: string[];
      };
      message?: string;
    }
  | undefined;

export type SessionPayload = {
  userId: string;
  role: Role;
  name: string;
  email: string;
  expiresAt: Date;
};
