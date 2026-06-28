#!/bin/bash
# Full oracle setup - run this once the deployer has ETH
# Usage: bash scripts/full_oracle_setup.sh

set -e

echo "=== Deploying Patched Oracle ==="
# Use the deployer key directly
export PRIVATE_KEY="fe3573b91574182b58d87630a31119a615035767f3c03f96b089f0bc009651de"

npx hardhat run scripts/deploy_patched_oracle.js --network base

echo ""
echo "=== Updating Address Book ==="
echo "Add the new oracle address to address.book"
