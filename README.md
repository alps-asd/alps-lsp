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

### Validation
- Real-time syntax validation for XML and JSON
- Semantic validation for ALPS structure
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
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│  VS Code  │ │ JetBrains │ │    Zed    │ │Vim/Neovim │
└─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
      │             │             │             │
      └─────────────┴──────┬──────┴─────────────┘
                           │ LSP (stdio)
                    ┌──────▼──────┐
                    │  alps-lsp   │
                    └─────────────┘
```

## Development

```bash
npm install    # Install dependencies
npm run build  # Build
npm test       # Test
```

## License

MIT
