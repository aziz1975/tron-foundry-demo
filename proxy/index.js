const express = require("express");
const fs = require("fs");
const path = require("path");

const config = require("./config");
const store = require("./store");

const { makeUpstreamService } = require("./services/upstreamService");
const { makeTronService } = require("./services/tronService");
const { makeEthHandlers } = require("./handlers/ethHandlers");
const { makeRpcRouter } = require("./handlers/rpcRouter");

// ---- ABI loader with auto-reload ----
let abiCache = [];
let abiCachePath = null;
let abiCacheMtimeMs = 0;

function loadAbiFromArtifact() {
  if (!config.FOUNDRY_ARTIFACT_PATH) return [];

  const p = path.resolve(config.FOUNDRY_ARTIFACT_PATH);
  abiCachePath = p;

  if (!fs.existsSync(p)) {
    // Don't spam logs; just return last cache (or empty)
    return abiCache;
  }

  const stat = fs.statSync(p);
  if (stat.mtimeMs === abiCacheMtimeMs && abiCache.length) {
    return abiCache; // unchanged
  }

  // changed or first load
  const artifact = JSON.parse(fs.readFileSync(p, "utf8"));
  abiCache = artifact.abi || [];
  abiCacheMtimeMs = stat.mtimeMs;

  console.log("Loaded ABI from:", p, `(mtime=${new Date(stat.mtimeMs).toISOString()})`);
  return abiCache;
}

// Provide a getter so tronService can always use the latest ABI
function getDeployAbi() {
  return loadAbiFromArtifact();
}

// Load once at startup (optional)
loadAbiFromArtifact();

const upstreamService = makeUpstreamService({ upstreamJsonRpcUrl: config.UPSTREAM_JSONRPC });

const tronService = makeTronService({
  tronNodeBase: config.TRON_NODE_BASE,
  tronPrivateKey: config.TRON_PRIVATE_KEY,
  feeLimitSun: config.FEE_LIMIT_SUN,
  originEnergyLimit: config.ORIGIN_ENERGY_LIMIT,
  userFeePercentage: config.USER_FEE_PERCENTAGE,
  contractName: config.CONTRACT_NAME,
  getDeployAbi, // <-- NEW
});

console.log("Proxy signer (EVM 0x):", tronService.proxySignerEvm);

const ethHandlers = makeEthHandlers({ store, tronService, upstreamService });
const rpcRouter = makeRpcRouter({ ethHandlers, upstreamService });

const app = express();
app.use(express.json({ limit: "4mb" }));
app.post("/", rpcRouter);

app.listen(config.PORT, "127.0.0.1", () => {
  console.log(`tron-ethrpc-proxy listening on http://127.0.0.1:${config.PORT}`);
  console.log(`Forwarding reads to: ${config.UPSTREAM_JSONRPC}`);
  if (config.FOUNDRY_ARTIFACT_PATH) {
    console.log(`Watching ABI artifact path: ${path.resolve(config.FOUNDRY_ARTIFACT_PATH)}`);
  }
});
