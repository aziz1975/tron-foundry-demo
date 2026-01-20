# TRON Foundry Demo (Foundry + TRON via Local JSON-RPC Proxy)

This repo demonstrates how to use **Foundry (forge/cast)** to **compile and deploy Solidity contracts to TRON (Nile)** using a small **Node.js JSON-RPC proxy**.

The key idea is:

- Foundry expects Ethereum-style RPC methods like `eth_sendRawTransaction` and `eth_getTransactionCount`.
- Several TRON JSON-RPC endpoints do not support those write methods directly.
- This proxy accepts Foundry’s `eth_sendRawTransaction` requests, converts them into **TRON-native deploy/broadcast** calls using **TronWeb**, and forwards read-only RPC calls to a **Chainstack TRON `/jsonrpc`** endpoint.

---

## Project Structure

```
.
├─ .github/workflows/test.yml
├─ lib/
│  ├─ forge-std/
│  └─ openzeppelin-contracts/
├─ proxy/
│  ├─ handlers/
│  │  ├─ ethHandlers.js
│  │  └─ rpcRouter.js
│  ├─ services/
│  │  ├─ tronService.js
│  │  └─ upstreamService.js
│  ├─ utils/
│  │  ├─ address.js
│  │  ├─ hex.js
│  │  └─ jsonrpc.js
│  ├─ config.js
│  ├─ index.js
│  └─ store.js
├─ script/
├─ src/
│  ├─ Counter.sol
│  ├─ Greeter.sol
│  ├─ MathLib.sol
│  └─ OZCounter.sol
├─ test/
│  └─ Counter.t.sol
├─ tools/tron-solc/
│  └─ solc-tron-0.8.23
├─ .env
├─ .env.sample
├─ foundry.toml
└─ package.json
```

---

## Requirements

- Node.js (Node 20+)
- Foundry (forge/cast)
- A Chainstack TRON Nile endpoint (base endpoint and `/jsonrpc`)
- TRX on Nile for the deployer address
- `tools/tron-solc/solc-tron-0.8.23` (TRON Solidity compiler)

---

## Install Foundry (forge/cast)

On Linux:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Verify:

```bash
forge --version
cast --version
```

---

## Install Node Dependencies (Proxy)

From repo root:

```bash
npm install
```

---

## Configure Chainstack

In Chainstack, create a TRON Nile node and copy:

- **Base endpoint** (no postfix):  
  `https://tron-nile.core.chainstack.com/<YOUR_TOKEN>`

- JSON-RPC endpoint (read-only forward target):  
  `https://tron-nile.core.chainstack.com/<YOUR_TOKEN>/jsonrpc`

The proxy uses the base endpoint for TRON-native `/wallet/*` calls through TronWeb, and forwards many `eth_*` reads to `/jsonrpc`.

---

## Environment Variables (`.env`)

Copy sample:

```bash
cp .env.sample .env
```

Edit `.env`:

- `CHAINSTACK_BASE_ENDPOINT` (base endpoint, no `/jsonrpc`)
- `TRON_PRIVATE_KEY`
- `DEPLOYER_ADDRESS`
- `FOUNDRY_ARTIFACT_PATH` (see section below)

### IMPORTANT: Always load `.env` into your shell

Every time you change `.env`, run:

```bash
set -a; source .env; set +a
```

This ensures variables are exported for your current terminal session.

---

## Start/Restart the Proxy

The proxy reads config from `.env`. If you change **any proxy code** or `.env`, restart the server.

```bash
node proxy/index.js
```

The proxy listens on:

- `http://127.0.0.1:${PORT}` (default `8545`)

---

## Install OpenZeppelin (Optional, for OZCounter)

Install locally:

```bash
forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.5.0
```

This creates `lib/openzeppelin-contracts/` so imports like:

```solidity
import "openzeppelin-contracts/contracts/access/Ownable.sol";
```

resolve correctly.

---

## Build Artifacts (Out Folder)

Always compile before deployment (especially after contract changes):

```bash
forge clean
forge build
```

Artifacts are generated under `out/<File>.sol/<Contract>.json`.

---

## Selecting the Correct Artifact (Important)

This repo’s proxy supports constructor decoding by using the **artifact ABI + creation bytecode**.

That means: **based on which contract you deploy, you must update `FOUNDRY_ARTIFACT_PATH` in `.env`.**

Examples:

- Counter:

  ```bash
  FOUNDRY_ARTIFACT_PATH="out/Counter.sol/Counter.json"
  ```

- Greeter:

  ```bash
  FOUNDRY_ARTIFACT_PATH="out/Greeter.sol/Greeter.json"
  ```

- OZCounter:
  ```bash
  FOUNDRY_ARTIFACT_PATH="out/OZCounter.sol/OZCounter.json"
  ```

After changing `FOUNDRY_ARTIFACT_PATH`, always:

1. reload `.env`
2. restart proxy

```bash
set -a; source .env; set +a
node proxy/index.js
```

---

## Generate `DEPLOYER_ADDRESS`

`OZCounter` needs an EVM-style `0x...` address for `initialOwner`.

Generate and save into `.env`:

```bash
echo "DEPLOYER_ADDRESS=$(cast wallet address --private-key "$TRON_PRIVATE_KEY")" >> .env
```

Then reload `.env`:

```bash
set -a; source .env; set +a
```

---

## Deploy Contracts via Foundry (through the Proxy)

### 1) Counter (no constructor args)

```bash
forge create src/Counter.sol:Counter   --rpc-url http://127.0.0.1:8545   --private-key "$TRON_PRIVATE_KEY"   --legacy   --broadcast   -vvvv
```

### 2) Greeter (constructor: `string initialGreeting`)

Make sure `FOUNDRY_ARTIFACT_PATH` points to Greeter, then:

```bash
forge create src/Greeter.sol:Greeter   --rpc-url http://127.0.0.1:8545   --private-key "$TRON_PRIVATE_KEY"   --legacy   --broadcast   --constructor-args "Hello World"   -vvvv
```

### 3) OZCounter (constructor: `address initialOwner`)

Make sure `FOUNDRY_ARTIFACT_PATH` points to OZCounter, then:

```bash
forge create src/OZCounter.sol:OZCounter   --rpc-url http://127.0.0.1:8545   --private-key "$TRON_PRIVATE_KEY"   --legacy   --broadcast   --constructor-args "$DEPLOYER_ADDRESS"   -vvvv
```

---

## Tests (EVM Only)

### Why a special profile?

TRON’s compiler produces bytecode that the local EVM test runner may not execute.
So tests must use standard Solidity compilation.

Use the `test` profile:

```bash
FOUNDRY_PROFILE="test" forge test
```

More verbose:

```bash
FOUNDRY_PROFILE="test" forge test -vvv
```

### Debug tests (interactive)

Foundry version doesn’t support `forge debug` as a separate subcommand. Use `--debug` on `forge test`:

```bash
FOUNDRY_PROFILE="test" forge test --debug   --match-contract "CounterTest"   --match-test "test_increment_usesLibrary"   -vvvv
```

---

## GitHub Actions (CI)

This repo uses a GitHub Actions workflow that:

- installs Foundry
- installs OpenZeppelin
- builds and tests under the `ci` profile (standard solc)

File: `.github/workflows/test.yml`

---

## Common Commands (Quick Reference)

### Load environment variables into the shell

```bash
set -a; source .env; set +a
```

### Start the proxy server

```bash
node proxy/index.js
```

### Clean and build artifacts

```bash
forge clean
forge build
```

### Deploy Counter

```bash
forge create src/Counter.sol:Counter --rpc-url http://127.0.0.1:8545 --private-key "$TRON_PRIVATE_KEY" --legacy --broadcast -vvvv
```

### Deploy Greeter with constructor args

```bash
forge create src/Greeter.sol:Greeter --rpc-url http://127.0.0.1:8545 --private-key "$TRON_PRIVATE_KEY" --legacy --broadcast --constructor-args "Hello World" -vvvv
```

### Deploy OZCounter with constructor args

```bash
forge create src/OZCounter.sol:OZCounter --rpc-url http://127.0.0.1:8545 --private-key "$TRON_PRIVATE_KEY" --legacy --broadcast --constructor-args "$DEPLOYER_ADDRESS" -vvvv
```

### Install OpenZeppelin

```bash
forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.5.0
```

### Generate deployer address for OZCounter

```bash
echo "DEPLOYER_ADDRESS=$(cast wallet address --private-key "$TRON_PRIVATE_KEY")" >> .env
```

### Run tests with standard solc

```bash
FOUNDRY_PROFILE="test" forge test
```

### Debug a test

```bash
FOUNDRY_PROFILE="test" forge test --debug --match-contract "CounterTest" --match-test "test_increment_usesLibrary" -vvvv
```

### Code coverage

```bash
FOUNDRY_PROFILE="test" forge coverage
```

### Code format

```bash
forge fmt
```

---

## Notes / Troubleshooting

### 1) “Cannot split constructor args from tx.data”

This usually means:

- you are deploying contract A, but `FOUNDRY_ARTIFACT_PATH` points to contract B, or
- you changed `.env` but didn’t reload it, or
- you didn’t recompile (`forge build`) after contract changes.

Fix:

1. set correct `FOUNDRY_ARTIFACT_PATH`
2. run `set -a; source .env; set +a`
3. restart proxy (`node proxy/index.js`)
4. `forge clean && forge build`
5. deploy again

### 2) Tronscan “No Data” (no Read/Write UI)

This usually means Tronscan doesn’t have the ABI metadata.
Option A is easiest: upload/verify ABI on Tronscan.

### 3) After changing `.env`

Always:

```bash
set -a; source .env; set +a
node proxy/index.js
```

### 4) OpenZeppelin import errors in CI

Make sure CI installs OZ or runs `forge install`. This repo’s workflow installs OZ explicitly.

---

## License

MIT
