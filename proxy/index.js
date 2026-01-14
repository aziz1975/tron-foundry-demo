const express = require("express");
const fs = require("fs");
const path = require("path");

const config = require("./config");
const store = require("./store");

const { makeUpstreamService } = require("./services/upstreamService");
const { makeTronService } = require("./services/tronService");
const { makeEthHandlers } = require("./handlers/ethHandlers");
const { makeRpcRouter } = require("./handlers/rpcRouter");

// Load ABI (optional)
let deployAbi = [];
if (config.FOUNDRY_ARTIFACT_PATH) {
  const p = path.resolve(config.FOUNDRY_ARTIFACT_PATH);
  if (fs.existsSync(p)) {
    const artifact = JSON.parse(fs.readFileSync(p, "utf8"));
    deployAbi = artifact.abi || [];
    console.log("Loaded ABI from:", p);
  } else {
    console.warn("FOUNDRY_ARTIFACT_PATH not found; ABI will be empty.");
  }
}

const upstreamService = makeUpstreamService({ upstreamJsonRpcUrl: config.UPSTREAM_JSONRPC });

const tronService = makeTronService({
  tronNodeBase: config.TRON_NODE_BASE,
  tronPrivateKey: config.TRON_PRIVATE_KEY,
  feeLimitSun: config.FEE_LIMIT_SUN,
  originEnergyLimit: config.ORIGIN_ENERGY_LIMIT,
  userFeePercentage: config.USER_FEE_PERCENTAGE,
  contractName: config.CONTRACT_NAME,
  deployAbi,
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
});
