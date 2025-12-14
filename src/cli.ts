#!/usr/bin/env node
/**
 * CLI entry point for ALPS LSP server
 *
 * Usage:
 *   alps-lsp              # Start server using stdio (only mode currently supported)
 *   alps-lsp --version    # Show version
 *   alps-lsp --help       # Show help
 *
 * Note: WebSocket and TCP modes are planned for future releases (see ADR 0001).
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Parse command line arguments
const args = process.argv.slice(2);

// Show help
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
ALPS Language Server Protocol (LSP)

Usage:
  alps-lsp [options]

Options:
  --version, -v        Show version number
  --help, -h           Show this help message

Description:
  ALPS Language Server provides IDE features for ALPS (Application-Level Profile Semantics) documents.
  
  Supported features:
  - Syntax validation (XML and JSON)
  - Auto-completion
  - Go to Definition
  - Find All References
  - Hover information
  - Document Symbols
  - Rename/Refactor

  Supported formats:
  - ALPS JSON (.alps.json)
  - ALPS XML (.alps.xml, .xml)

For more information, visit: https://github.com/alps-asd/alps-lsp
`);
    process.exit(0);
}

// Show version
if (args.includes('--version') || args.includes('-v')) {
    try {
        const packageJson = JSON.parse(
            readFileSync(join(__dirname, '../package.json'), 'utf-8')
        );
        console.log(`ALPS LSP v${packageJson.version}`);
    } catch (error) {
        console.log('Version information not available');
    }
    process.exit(0);
}

// Start the server with stdio transport
import('./server').catch((error) => {
    console.error('Failed to start ALPS LSP server:', error);
    process.exit(1);
});
