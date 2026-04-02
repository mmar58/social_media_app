#!/usr/bin/env node
const {
  DEFAULT_BASE_URL,
  DEFAULT_USERS_FILE,
  buildGeneratedUser,
  parseArgs,
  registerUser,
  toNumber,
  writeJson,
} = require("./helpers");

function printHelp() {
  console.log(`
Register multiple users for local multi-user testing.

Options:
  --base-url <url>       API base URL. Default: ${DEFAULT_BASE_URL}
  --count <n>            Number of users to create. Default: 5
  --password <value>     Password for all generated users. Default: Passw0rd!
  --email-prefix <value> Email prefix before +runId. Default: social-load
  --out <path>           Output file. Default: ${DEFAULT_USERS_FILE}
  --help                 Show this message
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const baseUrl = args["base-url"] || DEFAULT_BASE_URL;
  const count = toNumber(args.count, 5);
  const password = args.password || "Passw0rd!";
  const emailPrefix = args["email-prefix"] || "social-load";
  const outFile = args.out || DEFAULT_USERS_FILE;
  const runId = Date.now();

  const users = [];

  for (let index = 0; index < count; index += 1) {
    const payload = buildGeneratedUser(index, password, emailPrefix, runId);
    const result = await registerUser(baseUrl, payload);

    users.push({
      ...payload,
      token: result.token,
      user: result.user,
    });

    console.log(`Registered ${payload.email}`);
  }

  writeJson(outFile, {
    baseUrl,
    createdAt: new Date().toISOString(),
    users,
  });

  console.log(`Saved ${users.length} users to ${outFile}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});