#!/bin/bash
# Build script for UCP Trie Search WASM module

set -e

echo "Building UCP Trie Search WASM module..."

# Ensure wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build for web target
wasm-pack build --target web --out-dir pkg --release

# Copy to web public directory
mkdir -p ../../web/public/wasm
cp pkg/ucp_trie_search.js ../../web/public/wasm/
cp pkg/ucp_trie_search_bg.wasm ../../web/public/wasm/

echo "WASM build complete. Files copied to web/public/wasm/"
