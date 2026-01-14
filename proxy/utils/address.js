function tronHexToEvm0x(tronHex) {
  const h = tronHex.startsWith("0x") ? tronHex.slice(2) : tronHex;
  if (h.length !== 42 || !h.startsWith("41")) return null;
  return "0x" + h.slice(2);
}

function evmToTronHex(evm0x) {
  const a = (evm0x || "").toLowerCase();
  if (!a.startsWith("0x") || a.length !== 42) throw new Error("Invalid EVM address: " + evm0x);
  return "41" + a.slice(2);
}

module.exports = { tronHexToEvm0x, evmToTronHex };
