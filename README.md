# TRON Foundry Demo (Foundry + TRON via Local JSON-RPC Proxy)

This repo demonstrates how to use **Foundry (forge/cast)** to **compile and deploy Solidity contracts to TRON (Nile)** using a small **Node.js JSON-RPC proxy**.

The key idea is:

- Foundry expects Ethereum-style RPC methods like `eth_sendRawTransaction` and `eth_getTransactionCount`.
- Many TRON JSON-RPC endpoints do not support those write methods directly.
- This proxy accepts Foundry’s `eth_sendRawTransaction` requests, converts them into **TRON-native deploy/broadcast** calls using **TronWeb**, and forwards read-only RPC calls to a **TRON JSON-RPC `/jsonrpc`** endpoint (e.g., TronGrid).

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

## Useful links

- Repo: https://github.com/aziz1975/tron-foundry-demo
- Foundry: https://getfoundry.sh/
- `forge create` reference: https://getfoundry.sh/forge/reference/create/
- Foundry CI guide: https://getfoundry.sh/config/continuous-integration/
- TronGrid docs: https://www.trongrid.io/documents
- OpenZeppelin Contracts: https://github.com/OpenZeppelin/openzeppelin-contracts

---

## Requirements

- Node.js (Node 20+)
- Foundry (forge/cast)
- TRON endpoint (TronGrid): base endpoint + `/jsonrpc`
- TRX on Nile for the deployer address
- TRON Solidity compiler binary: `tools/tron-solc/solc-tron-0.8.23` (for deployment builds)

---

## Install Foundry (forge/cast)

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

## Install Node dependencies (proxy)

```bash
npm install
```

---

## Configure TRON endpoint (TronGrid example)

Use the **base endpoint** (no postfix):

- Nile: `https://nile.trongrid.io`
- Shasta: `https://api.shasta.trongrid.io`
- Mainnet: `https://api.trongrid.io`

Your proxy will forward reads to: `<BASE>/jsonrpc`.

---

## Environment Variables (`.env`)

Copy sample:

```bash
cp .env.sample .env
```

Every time you change `.env`, reload it in your terminal **and restart the proxy**:

```bash
set -a; source .env; set +a
node proxy/index.js
```

### Important: choose the correct artifact per deployment

The proxy uses `FOUNDRY_ARTIFACT_PATH` to attach ABI and to decode constructor arguments.

Set it to match the contract you are deploying:

- Counter: `out/Counter.sol/Counter.json`
- Greeter: `out/Greeter.sol/Greeter.json`
- OZCounter: `out/OZCounter.sol/OZCounter.json`

After changing it:

```bash
set -a; source .env; set +a
node proxy/index.js
```

---

## Build artifacts before deploying

```bash
forge clean
forge build
```

---

## Deploy contracts via Foundry (through the proxy)

### Counter (no constructor args)

```bash
forge create src/Counter.sol:Counter --rpc-url http://127.0.0.1:8545 --private-key "$TRON_PRIVATE_KEY" --legacy --broadcast -vvvv
```

After deployment, Forge prints output similar to this:

```text
Deployer: 0xE57Ea93173DeA454EfF302E48E58DbA4F942dDBb
Deployed to: 0xb73d26849904b82435b64eE5F44A132873e6A4ad
Transaction hash: 0x2fab7cc68e1e5c9983508a58810dc6ea3e18f861834ad98402ea4ea6cd920f4a
```

To check the transaction on Tronscan, copy the **Transaction hash**, remove the `0x` prefix, and search the remaining value (the txid) on Tronscan.

### Greeter (constructor string)

```bash
forge create src/Greeter.sol:Greeter   --rpc-url http://127.0.0.1:8545   --private-key "$TRON_PRIVATE_KEY"   --legacy   --broadcast   --constructor-args "Hello World"   -vvvv
```

### OZCounter (imports OpenZeppelin, constructor address)

Install OpenZeppelin:

```bash
forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.5.0
```

Generate `DEPLOYER_ADDRESS` (owner) in .env file:

```bash
echo "DEPLOYER_ADDRESS=$(cast wallet address --private-key "$TRON_PRIVATE_KEY")" >> .env
```

Deploy:

```bash
forge create src/OZCounter.sol:OZCounter   --rpc-url http://127.0.0.1:8545   --private-key "$TRON_PRIVATE_KEY"   --legacy   --broadcast   --constructor-args "$DEPLOYER_ADDRESS"   -vvvv
```

---

## Tests (EVM only)

### Why a special profile?

TRON’s compiler produces bytecode that the local EVM test runner may not execute.
So tests must use standard Solidity compilation.
Use the `test` profile (standard solc). **Run `forge clean` before `forge test`**.

```bash
forge clean
FOUNDRY_PROFILE="test" forge test
```

Interactive debug:

```bash
forge clean
FOUNDRY_PROFILE="test" forge test --debug   --match-contract "CounterTest"   --match-test "test_increment_usesLibrary"   -vvvv
```

---

## Limitations and next improvements

### Feature support matrix

| Feature / Command                                         | Supported by this proxy | Notes / Workaround                                                                                                   |
| --------------------------------------------------------- | ----------------------: | -------------------------------------------------------------------------------------------------------------------- |
| `forge create` (deploy)                                   |                  ✅ Yes | Works via `eth_sendRawTransaction` translation to TRON-native deploy/broadcast.                                      |
| `forge create` + constructor args                         |                  ✅ Yes | Works.                                                                                                               |
| Imports (local `import "./MathLib.sol"`), Imports (OpenZeppelin)                  |                  ✅ Yes | Works.                                                                                                               |
| forge debug                                    |                  ⚠️ Partial | Works with standard Solidity compiler. Using the command `forge test --debug ...`                                                         |
| `forge test` using **TRON solc**                          |                   ❌ No | TRON compiler output is not compatible with Foundry’s local EVM runner.                                              |
| `forge test` using standard solc (`FOUNDRY_PROFILE=test`) |                  ✅ Yes | Recommended workflow for unit tests. Run `forge clean` first.                                                        |
| `forge coverage`                                |              ✅ Yes | Works |
| `forge fmt`                               |              ✅ Yes | Works         |
| Forking / `anvil --fork-url ...`                          |                   ❌ No | Requires much broader RPC parity than this proxy provides.                                                           |
| `forge verify-contract`                                   |                   ❌ No | Use Tronscan verification flow instead.                                                                              |

---

## CI (GitHub Actions)

The workflow installs OpenZeppelin and runs build/test using profile `ci` (standard solc). See `.github/workflows/test.yml`.

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
