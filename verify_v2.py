#!/usr/bin/env python3
"""
verify_v2.py — Etherscan V2 contract verification for AV Treasury stack.

PRIMARY : Etherscan V2 API (https://api.etherscan.io/v2/api)
          Uses full Standard-JSON (input+output) reconstructed from
          hardhat artifacts/build-info/*.json (solc 0.8.26).
FALLBACK: `hardhat verify --network base <addr> [args]`  (only if V2 POST fails)

Usage:
  python3 verify_v2.py --all
  python3 verify_v2.py --check            # just report verification status, no tx
  python3 verify_v2.py --addr 0x... --contract contracts/Foo.sol:Foo --ctor-args '[...]'
  python3 verify_v2.py --all --force      # re-submit even if already verified

Env (from .env): ETHERSCAN_API_V2, RPC_URL_BASE_5 (or RPC_URL_BASE)
Chain: Base mainnet (chainId 8453)
"""
import os, sys, json, glob, time, subprocess, argparse, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except Exception:
    pass

API_KEY = os.environ.get("ETHERSCAN_API_V2")
CHAIN_ID = 8453  # Base mainnet
V2_URL = "https://api.etherscan.io/v2/api"
HARDHAT = ROOT / "node_modules/.bin/hardhat"

# ----------------------------------------------------------------------------
# Contract registry: label -> (fully-qualified name, deployed address, ctor-args)
# Addresses sourced from address.book / deployed_stack.json
# ----------------------------------------------------------------------------
REGISTRY = [
    # label,                       fqname,                                     address,                                ctor_args
    ("AgToken",                    "contracts/av_suite/AgToken.sol:AgToken",
                                   "0x1D31719389Bd8b17277Ba367c26b830aE34D3674", []),
    ("AuToken",                    "contracts/av_suite/AuToken.sol:AuToken",
                                   "0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08", []),
    ("PID_Emission_Controller",    "contracts/PID_Emission_Controller_v3.sol:PID_Emission_Controller_v3",
                                   "0xB8F240870DBc1cD5F9262F8180350A29ea404268", []),
    ("TreasuryAMO",                "contracts/av_suite/TreasuryAMO.sol:TreasuryAMO",
                                   "0xF096cD4D24811B0F824c929907196bCB796bca88", []),
    ("TreasuryFlashBuy",           "contracts/av_suite/TreasuryFlashBuy.sol:TreasuryFlashBuy",
                                   "0xf6383860837E6cb983F9Af8Def92fc08F15Be65b", []),
    ("OracleFlashBuy",             "contracts/av_suite/OracleFlashBuy.sol:OracleFlashBuy",
                                   "0xDfD00984CC88728e830CEDe7e104b6b0C03EDDcc", []),
    ("QuasiCrystalOracle",         "contracts/av_suite/QuasiCrystalOracle.sol:QuasiCrystalOracle",
                                   "0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD", [], "SOURCE_NOT_IN_REPO"),
    ("AvOracleV5",                 "contracts/av_suite/AvOracleV5.sol:AvOracleV5",
                                   "0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB", [], "SOURCE_NOT_IN_REPO"),
    ("AVLPStaking_v2",             "contracts/av_suite/AVLPStaking_v2.sol:AVLPStaking_v2",
                                   "0x8F638B6C2EBD61A638561B6993930CF25D53ACB9", []),
    ("Governor",                   "contracts/av_suite/Governor.sol:Governor",
                                   "0x5F061c177b76753686122185989C2332C1d0e8b1", []),
    ("TimeLock",                   "contracts/av_suite/TimeLock.sol:TimeLock",
                                   "0x09058FdD4dD60b4E2F2C2F4c370DA3cB606c09Be", []),
    ("TreasurySafe",               "contracts/av_suite/TreasurySafe.sol:TreasurySafe",
                                   "0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e", []),
    ("SlipstreamRouter",           "contracts/av_suite/SlipstreamRouter.sol:SlipstreamRouter",
                                   "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", []),
    ("auLP_NFT",                   "contracts/av_suite/AuLPNFT.sol:AuLPNFT",
                                   "0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8", []),
    ("FlashLoan",                  "contracts/av_suite/FlashLoan.sol:FlashLoan",
                                   "0x4DDD1873964E5C2E3BE6712E199812903E6696B9", []),
    ("DexSimulator",               "contracts/av_suite/DexSimulator.sol:DexSimulator",
                                   "0x2C1bD0e498cEA315dA7486a41FB3Dd991DA302B2", []),
]

# ----------------------------------------------------------------------------
# On-chain proxy detection (ERC-1967 implementation slot)
# ----------------------------------------------------------------------------
def _rpc():
    try:
        from web3 import Web3
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env")
        candidates = []
        for k in ("RPC_URL_BASE_5", "RPC_URL_BASE", "RPC_URL"):
            v = os.environ.get(k)
            if v:
                candidates.append(v)
        # also reuse keeper's RPC list if present
        try:
            sys.path.insert(0, str(ROOT / "keeper"))
            from keeper.config import RPC_LIST as _rl
            candidates += list(_rl)
        except Exception:
            pass
        for v in candidates:
            try:
                w3 = Web3(Web3.HTTPProvider(v, request_kwargs={"timeout": 15}))
                if w3.eth.block_number > 0:
                    return w3
            except Exception:
                continue
    except Exception:
        pass
    return None

ERC1967 = int(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc)
def impl_address(addr):
    """Return implementation address if `addr` is an ERC-1967 proxy, else None."""
    w3 = _rpc()
    if not w3:
        return None
    try:
        slot = w3.eth.get_storage_at(addr, ERC1967)
        impl = "0x" + slot.hex()[-40:]
        if impl == "0x" + "0" * 40:
            return None
        return impl
    except Exception:
        return None

# ----------------------------------------------------------------------------
# Build-info mapping: fqname -> build-info file
# ----------------------------------------------------------------------------
def map_buildinfo():
    m = {}
    for bi in sorted(glob.glob(str(ROOT / "artifacts/build-info/*.json"))):
        d = json.load(open(bi))
        if "input" not in d or "output" not in d:
            continue
        cons = d["output"].get("contracts", {})
        for path, cs_ in cons.items():
            for n in cs_:
                m[f"{path}:{n}"] = bi
    return m

BIMAP = map_buildinfo()

def find_buildinfo(fqname):
    # try exact, then by contract name suffix
    if fqname in BIMAP:
        return BIMAP[fqname]
    name = fqname.split(":")[-1]
    for k, v in BIMAP.items():
        if k.endswith(":" + name):
            return v
    return None

# ----------------------------------------------------------------------------
# Etherscan V2 helpers
# ----------------------------------------------------------------------------
def _post(params, tries=3):
    import urllib.request, urllib.parse
    params = dict(params)
    params["apikey"] = API_KEY
    # Etherscan V2 REQUIRES chainid as a URL query parameter (not POST body)
    url = f"{V2_URL}?chainid={CHAIN_ID}"
    data = urllib.parse.urlencode(params).encode()
    last = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, data=data, method="POST",
                                         headers={"Content-Type": "application/x-www-form-urlencoded"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            last = e
            time.sleep(2)
    return {"status": "0", "message": "POST_FAILED", "result": str(last)}

def _get(params):
    import urllib.request, urllib.parse
    params = dict(params)
    params["apikey"] = API_KEY
    params["chainid"] = CHAIN_ID
    url = V2_URL + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode())

def check_verified(addr):
    # For proxies, check the implementation address too
    addrs = [addr]
    impl = impl_address(addr)
    if impl:
        addrs.append(impl)
    for a in addrs:
        try:
            r = _get({"module": "contract", "action": "getsourcecode", "address": a})
            if r.get("status") == "1" and r.get("result") and r["result"][0].get("SourceCode"):
                return True
        except Exception:
            pass
    return False

def submit_v2(fqname, addr, ctor_args):
    bi = find_buildinfo(fqname)
    if not bi:
        return False, f"no build-info for {fqname}"
    # If `addr` is a UUPS proxy, verify at the IMPLEMENTATION address instead.
    impl = impl_address(addr)
    verify_addr = impl if impl else addr
    if impl:
        print(f"    🔗 proxy detected: {addr} -> impl {impl}; verifying impl")
    d = json.load(open(bi))
    inp = d["input"]
    # Standard Input JSON for V2 (NOTE: no top-level "version" key —
    # Etherscan rejects it; compiler version is sent via compilerversion param)
    payload = {
        "language": d.get("language", "Solidity"),
        "sources": inp.get("sources", {}),
        "settings": inp.get("settings", {}),
    }
    # Etherscan V2: sourceCode is the JSON, passed as a string
    source_json = json.dumps(payload)
    params = {
        "module": "contract",
        "action": "verifysourcecode",
        "contractaddress": verify_addr,
        "sourceCode": source_json,
        "codeformat": "solidity-standard-json-input",
        "contractname": fqname,  # e.g. contracts/Foo.sol:Foo
        "compilerversion": "v" + (d.get("solcLongVersion") or d.get("solcVersion") or "0.8.26"),
        "optimizationUsed": 1 if inp.get("settings", {}).get("optimizer", {}).get("enabled") else 0,
    }
    # constructor args (ABI-encoded hex, no 0x) — left empty if none
    if ctor_args:
        params["constructorArguments"] = ctor_args if ctor_args.startswith("0x") else "0x" + ctor_args
    r = _post(params)
    if r.get("status") != "1":
        return False, r.get("result", r.get("message"))
    guid = r.get("result")
    return True, guid

def poll_guid(guid, timeout=90):
    waited = 0
    while waited < timeout:
        try:
            r = _get({"module": "contract", "action": "checkverifystatus", "guid": guid})
            res = r.get("result", "")
            if "Pending" in res or "In progress" in res:
                time.sleep(5); waited += 5; continue
            return res
        except Exception as e:
            return f"poll error: {e}"
    return "TIMEOUT"

# ----------------------------------------------------------------------------
# Fallback: hardhat verify
# ----------------------------------------------------------------------------
def verify_hardhat(addr, ctor_args):
    if not HARDHAT.exists():
        return "hardhat binary missing"
    cmd = [str(HARDHAT), "verify", "--network", "base", addr]
    if ctor_args:
        cmd += ctor_args if isinstance(ctor_args, list) else [ctor_args]
    try:
        out = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, timeout=180)
        return (out.stdout + out.stderr)[-1500:]
    except Exception as e:
        return f"hardhat error: {e}"

# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def verify_one(label, fqname, addr, ctor_args, check_only=False, force=False, note=None):
    print(f"\n=== {label} ({addr}) ===")
    print(f"    contract: {fqname}")
    if note == "SOURCE_NOT_IN_REPO":
        print("    ⚠️ SKIP: source not in repo (deployed from elsewhere). Cannot V2-verify.")
        return "source_missing"
    if not force and check_verified(addr):
        print("    ✅ already verified on Etherscan")
        return "verified"
    if check_only:
        print("    ⚪ not verified (check-only mode)")
        return "unverified"
    ok, res = submit_v2(fqname, addr, ctor_args)
    if ok:
        print(f"    🔄 V2 submitted. GUID={res}")
        status = poll_guid(res)
        if "Pass" in status or "Already" in status:
            print(f"    ✅ V2 verified: {status}")
            return "verified"
        print(f"    ⚠️ V2 result: {status}  -> falling back to hardhat")
    else:
        print(f"    ⚠️ V2 submit failed: {res}  -> falling back to hardhat")
    fb = verify_hardhat(addr, ctor_args)
    print(f"    🔧 hardhat fallback:\n{fb}")
    return "fallback"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--addr")
    ap.add_argument("--contract")
    ap.add_argument("--ctor-args", default="[]")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    if not API_KEY:
        print("❌ ETHERSCAN_API_V2 not set in .env"); sys.exit(1)

    if a.addr and a.contract:
        verify_one("CLI", a.contract, a.addr, json.loads(a.ctor_args), check_only=a.check, force=a.force)
        return
    if not a.all:
        ap.print_help(); sys.exit(1)

    results = {}
    for entry in REGISTRY:
        if len(entry) == 5:
            label, fqname, addr, ctor, note = entry
        else:
            label, fqname, addr, ctor = entry
            note = None
        results[label] = verify_one(label, fqname, addr, ctor, check_only=a.check, force=a.force, note=note)
    print("\n\n================ SUMMARY ================")
    for k, v in results.items():
        print(f"  {k:24} {v}")

if __name__ == "__main__":
    main()
