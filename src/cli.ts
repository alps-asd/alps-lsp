#!/usr/bin/env node
/**
 * CLI entry point for ALPS LSP server
 *
 * Usage:
 *   alps-lsp                      # Start server using stdio (default)
 *   alps-lsp --stdio              # Start server using stdio (explicit)
 *   alps-lsp --ws [--port 8011]   # Start WebSocket server (for browser editors)
 *   alps-lsp --version            # Show version
 *   alps-lsp --help               # Show help
 *
 * Note: TCP mode is planned for a future release (see ADR 0001).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { startServer } from './server';
import { startWebSocketServer } from './wsServer';

const DEFAULT_WS_PORT = 8011;

// Parse command line arguments
const args = process.argv.slice(2);

// Show help
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
ALPS Language Server Protocol (LSP)

Usage:
  alps-lsp [options]

Options:
  --stdio              Use stdio transport (default)
  --ws                 Start a WebSocket server (for browser editors)
  --port <number>      WebSocket port (default: ${DEFAULT_WS_PORT}, only with --ws)
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
  - Semantic Tokens
  - Code Actions (quick fixes)
  - Document Formatting

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

function getPort(): number {
    const portIndex = args.indexOf('--port');
    if (portIndex < 0) {
        return DEFAULT_WS_PORT;
    }
    const rawPort = args[portIndex + 1];
    const port = Number(rawPort);
    if (!rawPort || !/^\d+$/.test(rawPort) || port < 0 || port > 65535) {
        console.error(`Invalid port: ${rawPort}`);
        process.exit(1);
    }
    return port;
}

if (args.includes('--ws')) {
    // WebSocket transport: one language server instance per connection
    const port = getPort();
    try {
        const webSocketServer = startWebSocketServer(port);
        webSocketServer.on('listening', () => {
            console.log(`ALPS LSP listening on ws://localhost:${port}`);
        });
        webSocketServer.on('error', (error) => {
            console.error('WebSocket server error:', error.message);
            process.exit(1);
        });
    } catch (error) {
        console.error('Failed to start ALPS LSP WebSocket server:', error);
        process.exit(1);
    }
} else {
    // Default: stdio transport. createConnection detects the transport from
    // process.argv, so make a bare invocation behave like --stdio (this also
    // enables its console patching, which keeps stdout protocol-clean).
    if (!args.includes('--stdio')) {
        process.argv.push('--stdio');
    }
    try {
        startServer(createConnection(ProposedFeatures.all));
    } catch (error) {
        console.error('Failed to start ALPS LSP server:', error);
        process.exit(1);
    }
}
