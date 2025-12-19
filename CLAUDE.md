# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ALPS Language Server Protocol (LSP) implementation for Application-Level Profile Semantics. This is a standalone LSP server that provides code intelligence for ALPS documents in both XML and JSON formats across multiple editors (VS Code, JetBrains, Neovim, Zed, Emacs).

## Commands

### Build and Development

```bash
npm install      # Install dependencies
npm run build    # Build TypeScript to dist/
npm run watch    # Build in watch mode
npm test         # Run all tests with Vitest
npm run lint     # Lint source code
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test tests/alpsParser.test.ts

# Run with coverage
npm test -- --coverage
```

### Running the LSP Server

```bash
# Test the server locally
node dist/cli.js --stdio
```

## Architecture

### Core Components

**Language Server (`src/server.ts`)**
- Main LSP server using `vscode-languageserver` library
- Handles stdio communication with editors
- Coordinates between parsers, validators, and completion providers
- Manages document state and descriptors cache
- Implements LSP protocol features: completion, definition, references, hover, symbols, rename

**ALPS Parser (`src/alpsParser.ts`)**
- Parses both XML (via sax) and JSON (via jsonc-parser) ALPS documents
- Extracts descriptor information with position data (line/column)
- Returns `DescriptorInfo[]` containing id, type, doc, href, and location
- Central data structure used by all LSP features

**Validators**
- `src/ImprovedXMLValidator.ts`: SAX-based XML validation
- `src/jsonValidator.ts`: JSON structure validation using jsonc-parser

**Completion Providers**
- `src/completionItems.ts`: XML completion (tags, attributes, descriptor references)
- `src/jsonCompletion.ts`: JSON completion (properties, values)
- Both use `src/semanticTerms.ts` for Schema.org vocabulary (2700+ terms)

**Utilities**
- `src/utils.ts`: Helper functions for parsing context (finding open tags, attribute positions)
- `src/jsonParser.ts`: JSON parsing with JSONC support (comments, trailing commas)

### Language Support

The server distinguishes between two language IDs:
- `alps-json`: JSON ALPS documents (*.alps.json)
- `alps-xml`: XML ALPS documents (*.alps.xml)

Document language ID is tracked in `documentLanguageIds` Map and used to route to appropriate parsers/validators.

### LSP Features Implementation

**Completion**: Triggered by context (tag start, attribute position, `#` for references)
- XML: Tags, attributes, type values, href references
- JSON: Property names, type values, href references
- Schema.org terms from `semanticTerms.ts`

**Go to Definition**: From `href="#id"` to descriptor definition location

**Find References**: Finds all descriptors referencing a given id via `href="#id"`

**Hover**: Shows descriptor type, doc, and href when hovering over descriptor elements

**Document Symbols**: Provides outline of all descriptors in document

**Rename**: Renames descriptor id and updates all references in the document

### Data Flow

1. Editor sends document to server via LSP
2. `onDidChangeContent` triggers:
   - Parse document → extract descriptors → cache in `descriptors` array
   - Schedule validation (debounced 500ms via `validationTimer`)
3. LSP requests (completion, definition, etc.) use cached `descriptors` array
4. Parsers extract position information for accurate navigation

## File Organization

```
src/
├── server.ts              # Main LSP server
├── cli.ts                 # CLI entry point
├── alpsParser.ts          # XML/JSON parser
├── completionItems.ts     # XML completion provider
├── jsonCompletion.ts      # JSON completion provider
├── ImprovedXMLValidator.ts # XML validation
├── jsonValidator.ts       # JSON validation
├── semanticTerms.ts       # Schema.org vocabulary
├── jsonParser.ts          # JSON parsing utilities
└── utils.ts               # Helper functions

tests/
├── alpsParser.test.ts
├── completionItems.test.ts
├── jsonCompletion.test.ts
├── jsonValidator.test.ts
├── xmlValidator.test.ts
└── utils.test.ts
```

## Key Implementation Details

### Descriptor Position Tracking

Both XML and JSON parsers track line/column positions for each descriptor:
- XML: Uses SAX parser `line` and `column` properties during streaming parse
- JSON: Post-parse line search using regex to find descriptor id declarations

This position data enables Go to Definition, Find References, and Rename features.

### Validation Debouncing

Validation is debounced with 500ms delay to avoid excessive re-validation during rapid typing. Timer is cleared and reset on each document change.

### Schema.org Integration

`semanticTerms.ts` contains 2700+ Schema.org vocabulary terms with descriptions, used for intelligent completion suggestions when editing descriptor `href` attributes or JSON properties.

## Testing

Tests use Vitest framework. Test files mirror source file names with `.test.ts` suffix.

Key test patterns:
- Parser tests verify descriptor extraction with correct positions
- Completion tests verify context-aware suggestions
- Validator tests verify error detection and diagnostics

## Branch Strategy

Main branch: `1.x`

Always create feature branches for changes, never commit directly to `1.x`.
