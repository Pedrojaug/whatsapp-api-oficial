import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "send_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function getAdminUsername() {
  return process.env.ADMIN_USERNAME ?? (process.env.NODE_ENV === "production" ? "" : "admin");
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV === "production" ? "" : "send123");
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "local-dev-secret");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(value: string) {
  const secret = getSessionSecret();

  if (!secret) {
    return "";
  }

  return createHmac("sha256", secret).update(value).digest("hex");
}

function createSessionValue(username: string) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${username}.${expiresAt}`;
  const signature = sign(payload);

  return `${payload}.${signature}`;
}

function verifySessionValue(value?: string) {
  if (!value) {
    return false;
  }

  const [username, expiresAt, signature] = value.split(".");

  if (!username || !expiresAt || !signature) {
    return false;
  }

  if (Number(expiresAt) < Date.now()) {
    return false;
  }

  const expectedSignature = sign(`${username}.${expiresAt}`);

  return Boolean(expectedSignature) && safeCompare(signature, expectedSignature) && username === getAdminUsername();
}

export function verifyAdminCredentials(username: string, password: string) {
  const configuredUsername = getAdminUsername();
  const configuredPassword = getAdminPassword();

  if (!configuredUsername || !configuredPassword) {
    return false;
  }

  return safeCompare(username, configuredUsername) && safeCompare(password, configuredPassword);
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionValue(cookieStore.get(COOKIE_NAME)?.value);
}

export async function setAdminSession(username: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionValue(username), {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
