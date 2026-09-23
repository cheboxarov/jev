import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "jev");
const TIMEOUT_MS = 30000;

function goalFrom(branch) {
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry?.type !== "message" || entry.message?.role !== "user") continue;
    const attribution = entry.message.attribution;
    if (attribution !== undefined && attribution !== "user") continue;
    const content = entry.message.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .filter((block) => block?.type === "text")
              .map((block) => block.text ?? "")
              .join(" ")
          : "";
    const trimmed = text.trim();
    if (trimmed) return trimmed.slice(0, 600);
  }
  return "";
}

function runHook(payload) {
  return new Promise((done) => {
    const child = spawn(BIN, ["hook", "read"], { stdio: ["pipe", "pipe", "ignore"] });
    let out = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      done(null);
    }, TIMEOUT_MS);
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.on("error", () => {
      clearTimeout(timer);
      done(null);
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        done(JSON.parse(out));
      } catch {
        done(null);
      }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(payload));
  });
}

export default function (pi) {
  pi.on("tool_call", async (event, ctx) => {
    try {
      if (event?.toolName !== "read") return;
      const input = event.input;
      if (!input || typeof input.path !== "string" || input.path === "") return;
      if (input.path.includes("://") || input.path.includes("?")) return;

      const abs = input.path.startsWith("~/")
        ? join(homedir(), input.path.slice(2))
        : resolve(ctx.cwd, input.path);
      if (!existsSync(abs)) return;

      const goal = goalFrom(ctx.sessionManager.getBranch());
      if (goal.length < 12) return;

      const reply = await runHook({
        tool_name: "Read",
        tool_input: { file_path: abs },
        cwd: ctx.cwd,
        goal,
      });
      const updated = reply?.hookSpecificOutput?.updatedInput;
      if (typeof updated?.offset !== "number" || typeof updated?.limit !== "number") return;
      const end = updated.offset + updated.limit - 1;
      return { input: { ...input, path: `${input.path}:${updated.offset}-${end}` } };
    } catch {
      return;
    }
  });
}
