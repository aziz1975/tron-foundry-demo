const ethersPkg = require("ethers");
const ethers = ethersPkg.ethers ?? ethersPkg;

const { toQuantityHex } = require("../utils/hex");

function makeEthHandlers({ store, tronService, upstreamService }) {
  const { proxySignerEvm } = tronService;

  async function eth_getTransactionCount(params) {
    const addr = (params?.[0] || "").toLowerCase();
    return toQuantityHex(store.getNextNonce(addr));
  }

  // conservative stubs
  async function eth_estimateGas() {
    return toQuantityHex(8_000_000n);
  }

  async function eth_gasPrice() {
    // 10 gwei
    return "0x2540be400";
  }

  async function eth_sendRawTransaction(params) {
    const rawTxHex = params?.[0];
    if (typeof rawTxHex !== "string" || !rawTxHex.startsWith("0x")) {
      throw new Error("eth_sendRawTransaction expects a 0x... hex string");
    }

    const tx = ethers.Transaction.from(rawTxHex);

    if (!tx.hash || !tx.from) {
      throw new Error("Failed to parse raw tx. Ensure forge uses --legacy.");
    }

    const ethHash = tx.hash;
    const senderLower = tx.from.toLowerCase();

    // enforce signer match (safety)
    if (proxySignerEvm && senderLower !== proxySignerEvm.toLowerCase()) {
      throw new Error(
        `Sender mismatch. RawTx sender=${senderLower} but proxy key maps to ${proxySignerEvm}. Use same private key in forge and proxy.`
      );
    }

    store.bumpNonce(senderLower, BigInt(tx.nonce ?? 0));

    if (tx.value && tx.value !== 0n) {
      throw new Error("Non-zero tx.value not supported in this proxy.");
    }

    const dataHex = tx.data || "0x";
    const isCreate = tx.to == null;

    if (isCreate) {
      // expected CREATE address (what Forge checks)
      const expected = ethers.getCreateAddress({ from: tx.from, nonce: tx.nonce });
      const expectedLower = expected.toLowerCase();

      store.setExpectedMapping(expectedLower, ethHash);

      // store record early
      store.putTx(ethHash, {
        ethHash,
        tronTxid: null,
        expectedCreateLower: expectedLower,
        tronContractHex41: null,
        codeHex: null,
      });

      const bytecodeNo0x = dataHex.startsWith("0x") ? dataHex.slice(2) : dataHex;
      const result = await tronService.deployFromBytecode(bytecodeNo0x);

      if (!result?.result) {
        throw new Error("TRON broadcast failed: " + JSON.stringify(result));
      }

      const rec = store.getTx(ethHash);
      rec.tronTxid = result.txid;
      store.putTx(ethHash, rec);

      console.log("DEPLOY broadcasted:", { ethHash, tronTxid: result.txid, expected });

      return ethHash;
    }

    // contract call
    const toEvmLower = tx.to.toLowerCase();
    const ownerEvmLower = senderLower;
    const dataNo0x = dataHex.slice(2);

    const result = await tronService.triggerSmartContract({
      contractEvm0x: toEvmLower,
      ownerEvm0x: ownerEvmLower,
      dataHexNo0x: dataNo0x,
    });

    if (!result?.result) {
      throw new Error("TRON broadcast failed: " + JSON.stringify(result));
    }

    store.putTx(ethHash, {
      ethHash,
      tronTxid: result.txid,
      expectedCreateLower: null,
      tronContractHex41: null,
      codeHex: null,
    });

    console.log("CALL broadcasted:", { ethHash, tronTxid: result.txid });

    return ethHash;
  }

  /**
   * CRITICAL for eliminating Forge "contract was not deployed":
   * - For deploy txs:
   *   - return null until TRON provides contract_address
   *   - then return receipt.contractAddress = expected create address
   */
  async function eth_getTransactionReceipt(params) {
    const ethHash = params?.[0];
    const rec = store.getTx(ethHash);
    if (!rec || !rec.tronTxid) return null;

    let info;
    try {
      info = await tronService.getTransactionInfo(rec.tronTxid);
    } catch {
      return null;
    }
    if (!info || !info.id) return null;

    const blockNumber = info.blockNumber != null ? toQuantityHex(BigInt(info.blockNumber)) : null;
    const status = info.receipt ? (tronService.tronSuccess(info) ? "0x1" : "0x0") : "0x1";

    // deploy path: wait until contract_address exists
    if (rec.expectedCreateLower) {
      if (!info.contract_address) return null;

      rec.tronContractHex41 = info.contract_address;

      // fetch and cache code so eth_getCode(expected) is never "0x"
      if (!rec.codeHex) {
        rec.codeHex = await tronService.getContractBytecodeByHex41(info.contract_address);
        store.setCodeForExpected(rec.expectedCreateLower, rec.codeHex);
      }

      store.putTx(ethHash, rec);

      // Return contractAddress = expected (what Forge expects)
      return {
        transactionHash: ethHash,
        blockNumber,
        status,
        contractAddress: "0x" + rec.expectedCreateLower.slice(2), // keep as 0x... lowercase
        gasUsed: "0x0",
        cumulativeGasUsed: "0x0",
        logs: [],
        logsBloom: "0x" + "0".repeat(512),
      };
    }

    // non-deploy tx
    return {
      transactionHash: ethHash,
      blockNumber,
      status,
      contractAddress: null,
      gasUsed: "0x0",
      cumulativeGasUsed: "0x0",
      logs: [],
      logsBloom: "0x" + "0".repeat(512),
    };
  }

  /**
   * CRITICAL for Forge verification:
   * - eth_getCode(expectedCreate) must return non-empty bytecode
   * We serve it from cached TRON contract bytecode.
   */
  async function eth_getCode(params) {
    const addr = (params?.[0] || "").toLowerCase();
    const cached = store.getCodeForExpected(addr);
    if (cached && cached !== "0x") return cached;

    // If this addr is an expected CREATE we know about, try to self-heal:
    const ethHash = store.getEthHashByExpected(addr);
    if (ethHash) {
      const rec = store.getTx(ethHash);
      if (rec?.tronTxid) {
        try {
          const info = await tronService.getTransactionInfo(rec.tronTxid);
          if (info?.contract_address) {
            rec.tronContractHex41 = info.contract_address;
            rec.codeHex = await tronService.getContractBytecodeByHex41(info.contract_address);
            store.putTx(ethHash, rec);
            store.setCodeForExpected(addr, rec.codeHex);
            return rec.codeHex || "0x";
          }
        } catch {
          // ignore
        }
      }
      // Not ready yet; Forge will keep polling receipt
      return "0x";
    }

    // Not one of ours -> forward to Chainstack /jsonrpc
    const forwarded = await upstreamService.forward("eth_getCode", [params?.[0], params?.[1] ?? "latest"], 1);
    return forwarded?.result ?? "0x";
  }

  async function eth_getTransactionByHash(params) {
    const ethHash = params?.[0];
    const rec = store.getTx(ethHash);
    if (!rec) return null;
    // Minimal object (enough for many tools)
    return {
      hash: ethHash,
      from: tronService.proxySignerEvm,
      to: null,
      nonce: "0x0",
      input: "0x",
      value: "0x0",
      gas: "0x0",
      gasPrice: "0x0",
      blockHash: null,
      blockNumber: null,
      transactionIndex: null,
      type: "0x0",
    };
  }

  return {
    eth_getTransactionCount,
    eth_estimateGas,
    eth_gasPrice,
    eth_sendRawTransaction,
    eth_getTransactionReceipt,
    eth_getCode,
    eth_getTransactionByHash,
  };
}

module.exports = { makeEthHandlers };
