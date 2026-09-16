#!/bin/bash

echo "=========================================="
echo "অসমীয়া ভাষা - Assamese Programming Language"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed!"
    echo "Please install Node.js 14+ from: https://nodejs.org"
    exit 1
fi

echo "Node.js found: $(node --version)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Make CLI executable
chmod +x src/cli.js

# Create examples directory if it doesn't exist
mkdir -p examples

# Test the installation
echo ""
echo "Running tests..."
npm test

# Ask about global installation
echo ""
read -p "Do you want to install globally? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm link
    echo ""
    echo "Installed globally! You can now use 'asomiya' command anywhere."
fi

echo ""
echo "Setup complete!"
echo ""
echo "Quick Start:"
echo "-----------"
echo "1. Run a program:   node src/cli.js examples/hello.asm"
echo "2. Start REPL:      node src/cli.js --repl"
echo "3. Run tests:       npm test"
echo "4. Web interface:   npm run web (then open http://localhost:8080)"
echo ""
echo "If installed globally:"
echo "1. Run a program:   asomiya examples/hello.asm"
echo "2. Start REPL:      asomiya --repl"
echo ""
echo "Happy coding! অসমীয়াত প্ৰ'গ্ৰামিং কৰাৰ আনন্দ লওঁক!"