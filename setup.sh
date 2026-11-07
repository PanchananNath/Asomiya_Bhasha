#!/bin/bash
# অসমীয়া ভাষা ২.০ — setup script
set -e
echo "=========================================="
echo " অসমীয়া ভাষা ২.০ — Asomiya Bhasha compiler"
echo "=========================================="

if ! command -v node >/dev/null 2>&1; then
    echo "✗ Node.js পোৱা নগ'ল। Node.js 16 বা তাতকৈ নতুন ইনষ্টল কৰক: https://nodejs.org"
    exit 1
fi
echo "✓ Node.js: $(node --version)"

CC_FOUND=""
for c in "${CC:-}" cc gcc clang; do
    if [ -n "$c" ] && command -v "$c" >/dev/null 2>&1; then CC_FOUND="$c"; break; fi
done
if [ -z "$CC_FOUND" ]; then
    echo "✗ C কম্পাইলাৰ (gcc বা clang) পোৱা নগ'ল।"
    echo "  Ubuntu/Debian: sudo apt install build-essential"
    echo "  macOS:         xcode-select --install"
    echo "  Windows:       MSYS2 বা WSL-ত gcc ইনষ্টল কৰক"
    exit 1
fi
echo "✓ C compiler: $CC_FOUND"

npm install
chmod +x src/cli.js
npm test

read -p "সকলো ঠাইৰ পৰা 'asomiya' command ব্যৱহাৰ কৰিবলৈ global install কৰিব নেকি? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then npm link; fi

echo ""
echo "আৰম্ভ কৰক:"
echo "  node src/cli.js examples/hello.asb           # compile কৰি চলোৱা"
echo "  node src/cli.js build examples/hello.asb     # native executable"
echo "  node src/cli.js c examples/hello.asb         # তৈয়াৰ হোৱা C ক'ড চোৱা"
echo "  npm run web                                  # playground (http://localhost:8080)"
