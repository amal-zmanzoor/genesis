import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const nextBin = path.join(projectDir, "node_modules/next/dist/bin/next");

const env = { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH ?? ""}` };

const child = spawn(process.execPath, [nextBin, "dev", projectDir, "--webpack", "--port", "3000"], {
  stdio: "inherit",
  env,
});

child.on("exit", (code) => process.exit(code ?? 0));
