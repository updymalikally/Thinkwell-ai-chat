import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const env = { ...process.env };
const nextArgs = process.argv.slice(2);

// Hosting platforms provide PORT at runtime. Respect it for production starts,
// while keeping port 3001 as the local default.
if (nextArgs[0] === "start") {
  const portIndex = nextArgs.indexOf("-p");
  if (portIndex >= 0) nextArgs[portIndex + 1] = env.PORT || "3001";
  else nextArgs.push("-p", env.PORT || "3001");
}

const systemCaFlag = "--use-system-ca";

if (process.allowedNodeEnvironmentFlags.has(systemCaFlag)) {
  env.NODE_OPTIONS = [env.NODE_OPTIONS, systemCaFlag].filter(Boolean).join(" ");
}

const result = spawnSync(process.execPath, [nextCli, ...nextArgs], {
  env,
  stdio: "inherit",
});

if (result.error) {
  console.error("Could not start Next.js:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
