# ALPS Language Server

Language Server Protocol (LSP) implementation for [ALPS](http://alps.io/) (Application-Level Profile Semantics).

## Features

- Code completion for XML and JSON formats
- Descriptor reference completion (`#id`)
- Schema.org vocabulary suggestions (2700+ terms)
- Real-time validation
- Syntax error diagnostics

## Installation

```bash
npm install @alps-asd/lsp
```

## Usage

### As a standalone server

```bash
npx alps-lsp --stdio
```

### With VS Code

Use [vscode-asd](https://github.com/alps-asd/vscode-asd) extension.

### With other editors

Configure your editor's LSP client to use:

```bash
alps-lsp --stdio
```

## Supported Editors

| Editor | Status |
|--------|--------|
| VS Code | Supported via vscode-asd |
| JetBrains | Planned |
| Vim/Neovim | Use nvim-lspconfig |
| Emacs | Use lsp-mode |

## Architecture

```
┌───────────┐ ┌───────────┐ ┌───────────┐
│  VS Code  │ │ JetBrains │ │  Vim/NeoVim│
└─────┬─────┘ └─────┬─────┘ └─────┬─────┘
      │             │             │
      └─────────────┴──────┬──────┘
                           │ LSP (stdio/TCP)
                    ┌──────▼──────┐
                    │  alps-lsp   │
                    └─────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test
```

## License

MIT
