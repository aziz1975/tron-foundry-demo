require("dotenv").config();

function stripTrailingSlash(u) {
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

const PORT = Number(process.env.PORT || 8545);

const CHAINSTACK_BASE_ENDPOINT = stripTrailingSlash(process.env.CHAINSTACK_BASE_ENDPOINT || "");
if (!CHAINSTACK_BASE_ENDPOINT.startsWith("http")) {
  throw new Error("Missing/invalid CHAINSTACK_BASE_ENDPOINT in .env");
}

const UPSTREAM_JSONRPC = `${CHAINSTACK_BASE_ENDPOINT}/jsonrpc`;
const TRON_NODE_BASE = CHAINSTACK_BASE_ENDPOINT;

const TRON_PRIVATE_KEY = (process.env.TRON_PRIVATE_KEY || "").trim();
if (!TRON_PRIVATE_KEY) {
  throw new Error("Missing TRON_PRIVATE_KEY in .env");
}

const FEE_LIMIT_SUN = Number(process.env.FEE_LIMIT_SUN || 150000000);
const ORIGIN_ENERGY_LIMIT = Number(process.env.ORIGIN_ENERGY_LIMIT || 10000000);
const USER_FEE_PERCENTAGE = Number(process.env.USER_FEE_PERCENTAGE || 100);

const CONTRACT_NAME = process.env.CONTRACT_NAME || "Contract";
const FOUNDRY_ARTIFACT_PATH = process.env.FOUNDRY_ARTIFACT_PATH || "";

module.exports = {
  PORT,
  CHAINSTACK_BASE_ENDPOINT,
  UPSTREAM_JSONRPC,
  TRON_NODE_BASE,
  TRON_PRIVATE_KEY,
  FEE_LIMIT_SUN,
  ORIGIN_ENERGY_LIMIT,
  USER_FEE_PERCENTAGE,
  CONTRACT_NAME,
  FOUNDRY_ARTIFACT_PATH,
};
