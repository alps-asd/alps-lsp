# ALPS Language Server

Language Server Protocol (LSP) implementation for [ALPS](http://alps.io/) (Application-Level Profile Semantics).

## Features

### Code Intelligence
- **Auto-completion**: XML and JSON formats with context-aware suggestions
- **Descriptor reference completion**: `#id` with smart completion
- **Schema.org vocabulary**: 2700+ terms with definitions
- **Go to Definition**: Jump from `href="#id"` to descriptor definition
- **Find All References**: Find all usages of a descriptor
- **Hover Information**: Show descriptor type, doc, and href on hover
- **Document Symbols**: Outline view of all descriptors
- **Rename/Refactor**: Rename descriptors with automatic reference updates
- **Semantic Tokens**: Highlight descriptor ids by ALPS type (semantic/safe/unsafe/idempotent), `#id` references, and type values
- **Code Actions**: Quick fixes for broken `#id` references (create the missing descriptor) and naming conventions (rename `safe` ids to `goXxx`, `unsafe`/`idempotent` ids to `doXxx`)
- **Formatting**: Document formatting for JSON and XML (conservative, idempotent)

### Validation
- Real-time syntax validation for XML and JSON
- Semantic validation for ALPS structure: broken local references and transition naming conventions
- Detailed error diagnostics with line numbers

## Quick Start

```bash
git clone https://github.com/alps-asd/alps-lsp.git
cd alps-lsp
npm install
npm run build
```

Test the server:

```bash
node dist/cli.js --stdio
# The server will start in stdio mode (no output to stdout - all logging goes to stderr)
```

## WebSocket Mode (Browser Editors)

For browser-based editors (e.g. Ace), the server can run over WebSocket instead of stdio:

```bash
node dist/cli.js --ws              # listens on ws://localhost:8011
node dist/cli.js --ws --port 9000  # custom port
```

Each WebSocket connection gets its own language server instance. Messages are plain
JSON-RPC, one message per WebSocket frame (no `Content-Length` framing):

```js
const socket = new WebSocket('ws://localhost:8011');
socket.onopen = () => {
    socket.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { processId: null, rootUri: null, capabilities: {} }
    }));
};
socket.onmessage = (event) => console.log(JSON.parse(event.data));
```

Note: an `exit` notification from any client terminates the process, so run one
WebSocket server per editor session.

## Editor Setup

### JetBrains (IntelliJ, WebStorm, PhpStorm) ✅ Tested

1. Install [LSP4IJ](https://plugins.jetbrains.com/plugin/23257-lsp4ij) plugin
2. Settings → Languages & Frameworks → Language Servers → Add
3. Server tab:
   - **Command**: `/path/to/node` (use `which node` to find full path)
   - **Arguments**: `/path/to/alps-lsp/dist/cli.js`
4. Mappings tab:
   - File name patterns: `*.alps.json;*.alps.xml`
   - Language Id: `alps-json` (for JSON) or `alps-xml` (for XML)

### Other Editors

- **VS Code**: [vscode-asd](https://github.com/alps-asd/vscode-asd)
- **Zed**: [LSP documentation](https://zed.dev/docs/languages)
- **Neovim**: [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)
- **Emacs**: [lsp-mode](https://emacs-lsp.github.io/lsp-mode/)

## Architecture

```text
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│  VS Code  │ │ JetBrains │ │    Zed    │ │Vim/Neovim │ │  Browser  │
└─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
      │             │             │             │             │
      └─────────────┴──────┬──────┴─────────────┘             │
                           │ LSP (stdio)                      │ LSP (WebSocket)
                    ┌──────▼──────────────────────────────────▼──────┐
                    │                   alps-lsp                     │
                    └────────────────────────────────────────────────┘
```

## Development

```bash
npm install    # Install dependencies
npm run build  # Build
npm test       # Test
```

## License

MIT
