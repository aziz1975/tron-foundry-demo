/**
 * In-memory store for:
 * - local nonces (because TRON doesn't provide eth_getTransactionCount)
 * - tx mapping (ethHash -> tron txid, expected create address, deployed TRON contract address)
 * - code cache (expected create -> bytecode) so eth_getCode(expected) is never "0x"
 *
 * NOTE: This resets on proxy restart.
 */

const nextNonceByEvmAddr = new Map(); // evmAddrLower -> BigInt next nonce

function getNextNonce(addrLower) {
  return nextNonceByEvmAddr.get(addrLower) ?? 0n;
}

function bumpNonce(addrLower, seenNonce) {
  const current = getNextNonce(addrLower);
  const candidate = BigInt(seenNonce) + 1n;
  if (candidate > current) nextNonceByEvmAddr.set(addrLower, candidate);
}

// ethHash -> record
// record = { ethHash, tronTxid, expectedCreateLower, tronContractHex41, codeHex }
const txByEthHash = new Map();

// expectedCreateLower -> ethHash
const ethHashByExpected = new Map();

// expectedCreateLower -> codeHex (0x...)
const codeByExpected = new Map();

function putTx(ethHash, record) {
  txByEthHash.set(ethHash, record);
}

function getTx(ethHash) {
  return txByEthHash.get(ethHash) || null;
}

function setExpectedMapping(expectedLower, ethHash) {
  ethHashByExpected.set(expectedLower, ethHash);
}

function getEthHashByExpected(expectedLower) {
  return ethHashByExpected.get(expectedLower) || null;
}

function setCodeForExpected(expectedLower, codeHex) {
  codeByExpected.set(expectedLower, codeHex);
}

function getCodeForExpected(expectedLower) {
  return codeByExpected.get(expectedLower) || null;
}

module.exports = {
  getNextNonce,
  bumpNonce,
  putTx,
  getTx,
  setExpectedMapping,
  getEthHashByExpected,
  setCodeForExpected,
  getCodeForExpected,
};
