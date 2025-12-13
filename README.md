# ALPS Language Server

Language Server Protocol (LSP) implementation for [ALPS](http://alps.io/) (Application-Level Profile Semantics).

## Features

- Code completion for XML and JSON formats
- Descriptor reference completion (`#id`)
- Schema.org vocabulary suggestions (2700+ terms)
- Real-time validation
- Syntax error diagnostics

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
# Should output: ALPS Language Server is running
```

## Editor Setup

### JetBrains (IntelliJ, WebStorm, PhpStorm) ✅ Tested

1. Install [LSP4IJ](https://plugins.jetbrains.com/plugin/23257-lsp4ij) plugin
2. Settings → Languages & Frameworks → Language Servers → Add
3. Server tab:
   - **Command**: `/path/to/node` (use `which node` to find full path)
   - **Arguments**: `/path/to/alps-lsp/dist/cli.js --stdio`
4. Mappings tab:
   - File name patterns: `*.alps.json`, `alps.json`
   - Language Id: `alps-json`

### Other Editors

- **VS Code**: [vscode-asd](https://github.com/alps-asd/vscode-asd)
- **Zed**: [LSP documentation](https://zed.dev/docs/languages)
- **Neovim**: [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)
- **Emacs**: [lsp-mode](https://emacs-lsp.github.io/lsp-mode/)

## Architecture

```
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
