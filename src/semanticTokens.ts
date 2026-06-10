import { SemanticTokens, SemanticTokensBuilder, SemanticTokensLegend } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { scanDescriptors, ValueToken } from './alpsScanner';

// Token type indices into semanticTokensLegend.tokenTypes.
// Mapping (standard LSP token types):
// - 'class':    semantic state descriptors
// - 'function': safe transitions
// - 'method':   unsafe / idempotent transitions
// - 'property': #fragment references in href / rt
// - 'keyword':  type attribute values
const TOKEN_CLASS = 0;
const TOKEN_FUNCTION = 1;
const TOKEN_METHOD = 2;
const TOKEN_PROPERTY = 3;
const TOKEN_KEYWORD = 4;

export const semanticTokensLegend: SemanticTokensLegend = {
    tokenTypes: ['class', 'function', 'method', 'property', 'keyword'],
    tokenModifiers: []
};

const ALPS_DESCRIPTOR_TYPES = ['semantic', 'safe', 'unsafe', 'idempotent'];

function descriptorTokenType(type: string | undefined): number {
    switch (type) {
        case 'safe':
            return TOKEN_FUNCTION;
        case 'unsafe':
        case 'idempotent':
            return TOKEN_METHOD;
        default:
            return TOKEN_CLASS;
    }
}

interface RawToken {
    line: number;
    char: number;
    length: number;
    tokenType: number;
}

export function buildSemanticTokens(document: TextDocument, languageId: string): SemanticTokens {
    const occurrences = scanDescriptors(document.getText(), languageId);
    const tokens: RawToken[] = [];

    const addToken = (offset: number, length: number, tokenType: number) => {
        if (length <= 0) {
            return;
        }
        const position = document.positionAt(offset);
        tokens.push({ line: position.line, char: position.character, length, tokenType });
    };

    for (const occurrence of occurrences) {
        if (occurrence.id) {
            addToken(occurrence.id.offset, occurrence.id.value.length, descriptorTokenType(occurrence.type?.value));
        }
        if (occurrence.type && ALPS_DESCRIPTOR_TYPES.includes(occurrence.type.value)) {
            addToken(occurrence.type.offset, occurrence.type.value.length, TOKEN_KEYWORD);
        }
        for (const reference of [occurrence.href, occurrence.rt]) {
            const fragment = getFragment(reference);
            if (fragment) {
                addToken(fragment.offset, fragment.value.length, TOKEN_PROPERTY);
            }
        }
    }

    // SemanticTokensBuilder requires tokens to be pushed in document order
    tokens.sort((a, b) => a.line - b.line || a.char - b.char);

    const builder = new SemanticTokensBuilder();
    for (const token of tokens) {
        builder.push(token.line, token.char, token.length, token.tokenType, 0);
    }
    return builder.build();
}

/** Extracts the fragment part of a href/rt value (e.g. '#user' or 'profile.xml#user'). */
function getFragment(reference: ValueToken | undefined): ValueToken | undefined {
    if (!reference) {
        return undefined;
    }
    const hashIndex = reference.value.indexOf('#');
    if (hashIndex < 0 || hashIndex === reference.value.length - 1) {
        return undefined;
    }
    return {
        value: reference.value.slice(hashIndex + 1),
        offset: reference.offset + hashIndex + 1
    };
}
