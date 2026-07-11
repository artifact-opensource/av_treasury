# Mainnet / Testnet Vector Separation

> Policy for the `.vdb` semantic store. Enforced so testnet mock data NEVER contaminates mainnet reasoning.

## 1. The rule

- **Testnet prototype** (this dir) = `localhost` Hardhat, chainId `31337`, mock ERC20s, interval mining,
  throwaway accounts. Namespace: **`testnet`**.
- **Mainnet** = production deployment (Base / ETH), real `AU`/`AG` liquidity, real oracle
  (AvOracle / Chainlink), real governor + timelock, real funds. Namespace: **`mainnet`** (reserved).
- Every `.vdb` document carries a `namespace` field. Semantic queries MUST filter by namespace.

## 2. Why separation matters

- Testnet addresses (`0xe7f1...`, `0xCf7E...`, etc.) are **deterministic Hardhat addresses** — they do NOT
  exist on mainnet. Mixing them into mainnet reasoning would produce false "contract resolved" results.
- Testnet `AG` is a mock 18dp token; mainnet `AG` may differ. Testnet oracle returns `0.01` flat; mainnet
  oracle returns live price. Treating them interchangeably corrupts analysis.
- Testnet has no real value at risk. Mainnet does. A "buyback works on testnet" claim is NOT a mainnet guarantee.

## 3. .vdb layout

```
.vdb/
├── index.json            # TF-IDF index; namespaces: ["testnet","mainnet"]
├── documents.jsonl       # namespaced docs (tn-* = testnet, mn-* = mainnet policy)
├── testnet.map           # semantic -> testnet address/role remap (this prototype ONLY)
├── TESTNET_STRUCTURE.md  # granular testnet structure
└── MAINNET_SEPARATION.md # this file
```

When mainnet vectors are added later:
- Add `mn-*` docs with `namespace:"mainnet"`.
- Add a `mainnet.map` (semantic -> mainnet address/role remap).
- Update `index.json` `namespaces` + `termDf`.
- NEVER write a testnet address into a `mainnet` doc or `mainnet.map`.

## 4. Query isolation (pseudo)

```js
// testnet reasoning
search(query, { namespace: "testnet" });
// mainnet reasoning
search(query, { namespace: "mainnet" });
```

## 5. Deploy guard

- `scripts/deploy_testnet.js` targets `--network localhost` ONLY.
- Mainnet deploy (when built) targets a separate network config and separate `deployments/mainnet/`.
- `deployments/testnet/` is clearly separated from any future `deployments/mainnet/`.
