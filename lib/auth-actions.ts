"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { createSession, destroySession } from "./session";
import { SigninSchema, SignupSchema, type AuthFormState } from "./definitions";

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { message: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
  });

  await createSession({
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  });
  redirect("/events");
}

export async function signinAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = SigninSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { message: "Invalid email or password." };
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return { message: "Invalid email or password." };
  }

  await createSession({
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  });
  redirect("/events");
}

export async function signoutAction() {
  await destroySession();
  redirect("/signin");
}
