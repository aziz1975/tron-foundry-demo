const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

function stripTrailingSlash(u) {
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

function loadEnv() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(__dirname, ".env"),
    path.resolve(__dirname, "..", ".env"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      return;
    }
  }
  dotenv.config();
}

loadEnv();

const PORT = Number(process.env.PORT || 8545);

function deriveBaseEndpoint() {
  let base = (process.env.TRON_BASE_ENDPOINT || process.env.TRON_NODE_BASE || "").trim();

  if (!base) {
    const rpc = (process.env.TRON_RPC_URL || "").trim();
    if (rpc) {
      base = rpc.replace(/\/(jsonrpc|wallet|walletsolidity)\/?$/i, "");
    }
  }

  return stripTrailingSlash(base);
}

const TRON_BASE_ENDPOINT = deriveBaseEndpoint();

if (!TRON_BASE_ENDPOINT.startsWith("http")) {
  throw new Error(
    "Missing/invalid base endpoint. Set TRON_BASE_ENDPOINT to TronGrid, e.g.\n" +
      '  TRON_BASE_ENDPOINT="https://nile.trongrid.io"\n' +
      '  TRON_BASE_ENDPOINT="https://api.trongrid.io"'
  );
}

const UPSTREAM_JSONRPC = `${TRON_BASE_ENDPOINT}/jsonrpc`;
const TRON_NODE_BASE = TRON_BASE_ENDPOINT;

const TRON_PRIVATE_KEY = (process.env.TRON_PRIVATE_KEY || process.env.PRIVATE_KEY || "").trim();
if (!TRON_PRIVATE_KEY) {
  throw new Error('Missing TRON_PRIVATE_KEY (or PRIVATE_KEY).');
}

// TronGrid API key (optional for Nile/Shasta; often needed for mainnet)
const TRON_PRO_API_KEY = (process.env.TRON_PRO_API_KEY || "").trim();

const FEE_LIMIT_SUN = Number(process.env.FEE_LIMIT_SUN || 150000000);
const ORIGIN_ENERGY_LIMIT = Number(process.env.ORIGIN_ENERGY_LIMIT || 10000000);
const USER_FEE_PERCENTAGE = Number(process.env.USER_FEE_PERCENTAGE || 100);

const FOUNDRY_ARTIFACT_PATH = process.env.FOUNDRY_ARTIFACT_PATH || "";

module.exports = {
  PORT,
  TRON_BASE_ENDPOINT,
  UPSTREAM_JSONRPC,
  TRON_NODE_BASE,
  TRON_PRIVATE_KEY,
  TRON_PRO_API_KEY,
  FEE_LIMIT_SUN,
  ORIGIN_ENERGY_LIMIT,
  USER_FEE_PERCENTAGE,
  FOUNDRY_ARTIFACT_PATH,
};
