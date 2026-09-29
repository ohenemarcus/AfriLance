import { spawn } from "child_process";

const cmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(cmd, ["--filter", "@workspace/api-server", "run", "start"], {
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error("Failed to start API server:", err);
  process.exit(1);
});
