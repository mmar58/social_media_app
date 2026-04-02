#!/usr/bin/env node
const {
  DEFAULT_BASE_URL,
  DEFAULT_USERS_FILE,
  loginUser,
  parseArgs,
  readJson,
  writeJson,
} = require("./helpers");

function printHelp() {
  console.log(`
Login users from a generated user file and refresh their tokens.

Options:
  --base-url <url>   API base URL. Default: value from file or ${DEFAULT_BASE_URL}
  --input <path>     Input user file. Default: ${DEFAULT_USERS_FILE}
  --out <path>       Output file. Default: overwrite input file
  --help             Show this message
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const inputFile = args.input || DEFAULT_USERS_FILE;
  const outFile = args.out || inputFile;
  const existing = readJson(inputFile);
  const baseUrl = args["base-url"] || existing.baseUrl || DEFAULT_BASE_URL;
  const refreshedUsers = [];

  for (const entry of existing.users || []) {
    const result = await loginUser(baseUrl, entry.email, entry.password);
    refreshedUsers.push({
      ...entry,
      token: result.token,
      user: result.user,
    });

    console.log(`Logged in ${entry.email}`);
  }

  writeJson(outFile, {
    ...existing,
    baseUrl,
    updatedAt: new Date().toISOString(),
    users: refreshedUsers,
  });

  console.log(`Updated ${refreshedUsers.length} users in ${outFile}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});