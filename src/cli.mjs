#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  NOTEBOOK_QUESTIONS, OrvyqError, advanceProject, createProject, ingestNotebook, loadManifest,
  retryProject, runFull, runProof, runSmoke, safeProjectPath, validateProject
} from "./lib/core.mjs";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const values = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) values[key] = true;
    else { values[key] = next; index += 1; }
  }
  return {command, values};
}

function required(values, key) {
  if (!values[key]) throw new OrvyqError("ARGUMENT_REQUIRED", `--${key} is required`);
  return String(values[key]);
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const {command, values} = parseArgs(process.argv.slice(2));
  switch (command) {
    case "new":
      print(createProject({projectId: required(values, "project-id"), sourceUrl: required(values, "source-url"), minimumMinutes: Number(values["minimum-minutes"] || 10)}));
      break;
    case "status":
      print(loadManifest(required(values, "project-id")));
      break;
    case "questions": {
      const projectId = required(values, "project-id");
      const file = safeProjectPath(projectId, "input/notebooklm_questions.md");
      if (!fs.existsSync(file)) fs.writeFileSync(file, NOTEBOOK_QUESTIONS, "utf8");
      process.stdout.write(fs.readFileSync(file, "utf8"));
      break;
    }
    case "ingest-notebooklm":
      print(ingestNotebook(required(values, "project-id"), path.resolve(required(values, "file"))));
      break;
    case "next":
      print(advanceProject(required(values, "project-id")));
      break;
    case "retry":
      print(retryProject(required(values, "project-id")));
      break;
    case "validate":
      print(validateProject(required(values, "project-id"), {frozen: values.frozen === true}));
      break;
    case "smoke":
      print(runSmoke());
      break;
    case "proof":
      print(runProof({projectId: required(values, "project-id"), candidateSha: required(values, "candidate-sha"), proofRunId: required(values, "proof-run-id")}));
      break;
    case "full":
      print(runFull({projectId: required(values, "project-id"), candidateSha: required(values, "candidate-sha"), approvedProofRunId: required(values, "approved-proof-run-id"), proofManifestFile: required(values, "proof-manifest")}));
      break;
    default:
      throw new OrvyqError("UNKNOWN_COMMAND", "Use one of: new, status, questions, ingest-notebooklm, next, retry, validate, smoke, proof, full");
  }
}

main().catch((error) => {
  const payload = error instanceof OrvyqError
    ? {status: "BLOKE", code: error.code, message: error.message, details: error.details}
    : {status: "BAŞARISIZ", code: "UNEXPECTED", message: error?.stack || String(error)};
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = 1;
});
