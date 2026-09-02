#!/usr/bin/env node
/**
 * Updates the Supabase password in DATABASE_URL and DIRECT_URL in `.env`.
 *
 * Prompts for the password with echo off, URL-encodes it, and rewrites both
 * URLs. The password is never printed, never passed as an argument (so it
 * cannot land in shell history), and never leaves this machine.
 *
 * Usage:  node scripts/set-db-password.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";

const ENV_PATH = ".env";
const KEYS = ["DATABASE_URL", "DIRECT_URL"];

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const onData = (char) => {
      // Redraw the prompt without the typed characters.
      if (![("\n"), "\r", ""].includes(char.toString())) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(question);
      }
    };

    if (process.stdin.isTTY) process.stdin.on("data", onData);

    rl.question(question, (answer) => {
      if (process.stdin.isTTY) process.stdin.removeListener("data", onData);
      rl.close();
      process.stdout.write("\n");
      if (answer) {
        resolve(answer);
      } else {
        reject(new Error("No password entered."));
      }
    });
  });
}

function replacePassword(url, password) {
  // Rebuild rather than regex-replace, so a password containing delimiters
  // cannot corrupt the rest of the URL.
  const parsed = new URL(url);
  parsed.password = encodeURIComponent(password);
  return parsed.toString();
}

async function main() {
  if (!existsSync(ENV_PATH)) {
    throw new Error(`${ENV_PATH} not found. Run this from the project root.`);
  }

  let text = readFileSync(ENV_PATH, "utf8");

  for (const key of KEYS) {
    if (!new RegExp(`^${key}=`, "m").test(text)) {
      throw new Error(`${key} is missing from ${ENV_PATH}.`);
    }
  }

  const password = await promptHidden("New Supabase database password: ");

  for (const key of KEYS) {
    const match = text.match(new RegExp(`^${key}="?([^"\\n]*)"?$`, "m"));
    const current = match?.[1];
    if (!current) throw new Error(`${key} has no value to update.`);

    const updated = replacePassword(current, password);
    text = text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}="${updated}"`);
  }

  writeFileSync(ENV_PATH, text);

  // Report shape only — never values.
  console.log("\nUpdated .env:");
  for (const key of KEYS) {
    const value = text.match(new RegExp(`^${key}="?([^"\\n]*)"?$`, "m"))[1];
    const url = new URL(value);
    console.log(
      `  ${key}: valid  port=${url.port}  passwordSet=${url.password.length > 0}`,
    );
  }
  console.log("\nNext: npx prisma migrate status");
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
