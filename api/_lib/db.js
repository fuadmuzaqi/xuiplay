import { createClient } from "@libsql/client";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const db = createClient({
  url: required("TURSO_DATABASE_URL"),
  authToken: required("TURSO_AUTH_TOKEN")
});
