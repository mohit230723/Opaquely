// Injected EIP-1193 test wallet, announced over EIP-6963.
// It never sets isMetaMask. Tests drive it through window.__opaquelyE2E.

function install({ account, chainId }) {
  let currentAccount = account;
  let currentChainId = chainId;
  const listeners = {};

  const hex = (n) => "0x" + Number(n).toString(16);

  function emit(event, payload) {
    (listeners[event] || []).slice().forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        // A listener error must not break the wallet.
      }
    });
  }

  const provider = {
    async request({ method, params }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return currentAccount ? [currentAccount] : [];
        case "eth_chainId":
          return hex(currentChainId);
        case "net_version":
          return String(currentChainId);
        case "wallet_switchEthereumChain": {
          const next = parseInt(params[0].chainId, 16);
          currentChainId = next;
          emit("chainChanged", hex(next));
          return null;
        }
        case "wallet_addEthereumChain":
          return null;
        case "wallet_requestPermissions":
        case "wallet_getPermissions":
          return [{ parentCapability: "eth_accounts", caveats: [] }];
        case "wallet_revokePermissions":
          return null;
        case "eth_blockNumber":
          return "0x1";
        default: {
          const err = new Error("Unsupported method: " + method);
          err.code = 4200;
          throw err;
        }
      }
    },
    on(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
      return provider;
    },
    removeListener(event, fn) {
      listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
      return provider;
    },
    off(event, fn) {
      return provider.removeListener(event, fn);
    },
  };

  const icon =
    "data:image/svg+xml;base64," +
    btoa('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#1e3fd8"/></svg>');

  const detail = Object.freeze({
    info: Object.freeze({
      uuid: "7c1d3b52-0f8e-4a7a-9d0e-0e2e2e2e2e2e",
      name: "Opaquely E2E Wallet",
      icon,
      rdns: "com.opaquely.e2e",
    }),
    provider,
  });

  function announce() {
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
  }
  window.addEventListener("eip6963:requestProvider", announce);
  announce();

  window.__opaquelyE2E = {
    setAccount(addr) {
      currentAccount = addr;
      emit("accountsChanged", addr ? [addr] : []);
    },
    setChainId(id) {
      currentChainId = id;
      emit("chainChanged", hex(id));
    },
  };
}

/** Returns a self-contained script string for context.addInitScript({ content }). */
export function walletStubInitScript({ account, chainId }) {
  return `(${install.toString()})(${JSON.stringify({ account, chainId })});`;
}
