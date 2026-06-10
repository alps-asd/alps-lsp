import { FormattingOptions, Range, TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as jsonc from 'jsonc-parser';
import { validateXML } from './ImprovedXMLValidator';

/**
 * Formats an ALPS document. JSON is formatted with jsonc-parser's format();
 * XML with a small conservative pretty-printer. If the document does not
 * parse cleanly, no edits are returned.
 */
export function formatDocument(document: TextDocument, languageId: string, options: FormattingOptions): TextEdit[] {
    if (languageId === 'alps-json') {
        return formatJson(document, options);
    }
    if (languageId === 'alps-xml') {
        return formatXml(document, options);
    }
    return [];
}

function detectEol(text: string): '\n' | '\r\n' {
    return text.includes('\r\n') ? '\r\n' : '\n';
}

function formatJson(document: TextDocument, options: FormattingOptions): TextEdit[] {
    const text = document.getText();
    const errors: jsonc.ParseError[] = [];
    jsonc.parse(text, errors, { allowTrailingComma: true });
    if (errors.length > 0) {
        return [];
    }

    const edits = jsonc.format(text, undefined, {
        tabSize: options.tabSize,
        insertSpaces: options.insertSpaces,
        eol: detectEol(text)
    });
    return edits.map(edit => TextEdit.replace(
        Range.create(document.positionAt(edit.offset), document.positionAt(edit.offset + edit.length)),
        edit.content
    ));
}

// --- XML pretty-printer -------------------------------------------------
//
// Conservative by design: element and attribute order is preserved, nothing
// is dropped, and elements containing text content are kept verbatim
// (single-line text content is re-emitted inline). Only indentation between
// elements is normalized.

interface XmlElementNode {
    kind: 'element';
    name: string;
    openTag: string;
    selfClosing: boolean;
    children: XmlNode[];
    /** Document offset of '<' of the open tag */
    start: number;
    /** Document offset just past '>' of the matching close tag */
    end: number;
}

interface XmlLeafNode {
    kind: 'text' | 'comment' | 'processing-instruction' | 'doctype' | 'cdata';
    raw: string;
}

type XmlNode = XmlElementNode | XmlLeafNode;

function formatXml(document: TextDocument, options: FormattingOptions): TextEdit[] {
    const text = document.getText();
    if (text.trim() === '') {
        return [];
    }
    // Bail out if the document does not parse cleanly
    if (validateXML(text).length > 0) {
        return [];
    }

    const nodes = parseXmlNodes(text);
    if (!nodes) {
        return [];
    }

    const indentUnit = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
    const eol = detectEol(text);
    const lines: string[] = [];
    renderXmlNodes(nodes, 0, indentUnit, text, lines);

    let formatted = lines.join(eol);
    if (text.endsWith('\n')) {
        formatted += eol;
    }
    if (formatted === text) {
        return [];
    }
    return [TextEdit.replace(
        Range.create(document.positionAt(0), document.positionAt(text.length)),
        formatted
    )];
}

const XML_TOKEN_REGEX = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<\/[^>]+>|<[^>]+>|[^<]+/g;

/** Parses XML into a lightweight node tree. Returns null on structural problems. */
function parseXmlNodes(text: string): XmlNode[] | null {
    const root: XmlNode[] = [];
    const stack: XmlElementNode[] = [];
    const currentChildren = () => stack.length > 0 ? stack[stack.length - 1].children : root;

    let match: RegExpExecArray | null;
    XML_TOKEN_REGEX.lastIndex = 0;
    while ((match = XML_TOKEN_REGEX.exec(text)) !== null) {
        const token = match[0];
        if (token.startsWith('<!--')) {
            currentChildren().push({ kind: 'comment', raw: token });
        } else if (token.startsWith('<![CDATA[')) {
            currentChildren().push({ kind: 'cdata', raw: token });
        } else if (token.startsWith('<?')) {
            currentChildren().push({ kind: 'processing-instruction', raw: token });
        } else if (token.startsWith('<!')) {
            currentChildren().push({ kind: 'doctype', raw: token });
        } else if (token.startsWith('</')) {
            const name = token.slice(2, -1).trim();
            const element = stack.pop();
            if (!element || element.name !== name) {
                return null;
            }
            element.end = match.index + token.length;
        } else if (token.startsWith('<')) {
            const nameMatch = token.match(/^<\s*([A-Za-z_][A-Za-z0-9_.:-]*)/);
            if (!nameMatch) {
                return null;
            }
            const selfClosing = token.endsWith('/>');
            const element: XmlElementNode = {
                kind: 'element',
                name: nameMatch[1],
                openTag: token,
                selfClosing,
                children: [],
                start: match.index,
                end: match.index + token.length
            };
            currentChildren().push(element);
            if (!selfClosing) {
                stack.push(element);
            }
        } else {
            currentChildren().push({ kind: 'text', raw: token });
        }
    }
    return stack.length === 0 ? root : null;
}

function renderXmlNodes(nodes: XmlNode[], depth: number, indentUnit: string, text: string, lines: string[]): void {
    const indent = indentUnit.repeat(depth);
    for (const node of nodes) {
        if (node.kind === 'text') {
            // Whitespace-only text between elements is formatting noise
            continue;
        }
        if (node.kind !== 'element') {
            lines.push(indent + node.raw);
            continue;
        }
        if (node.selfClosing) {
            lines.push(indent + normalizeTag(node.openTag));
            continue;
        }

        const textChildren = node.children.filter(
            (child): child is XmlLeafNode => child.kind === 'text' && child.raw.trim() !== ''
        );
        if (textChildren.length > 0) {
            if (node.children.length === 1 && !textChildren[0].raw.includes('\n')) {
                // Single-line text content: keep it inline, preserving the text exactly
                lines.push(indent + normalizeTag(node.openTag) + textChildren[0].raw + `</${node.name}>`);
            } else {
                // Mixed or multi-line text content: keep the whole element verbatim
                lines.push(indent + text.slice(node.start, node.end));
            }
            continue;
        }

        lines.push(indent + normalizeTag(node.openTag));
        renderXmlNodes(node.children, depth + 1, indentUnit, text, lines);
        lines.push(indent + `</${node.name}>`);
    }
}

const XML_ATTRIBUTE_REGEX = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*("[^"]*"|'[^']*')/g;

/** Normalizes whitespace inside a tag, preserving attribute order and values. */
function normalizeTag(raw: string): string {
    const match = raw.match(/^<\s*([A-Za-z_][A-Za-z0-9_.:-]*)([\s\S]*?)(\/?)>$/);
    if (!match) {
        return raw;
    }
    // Bail out if the attribute section contains anything we do not recognize
    if (match[2].replace(XML_ATTRIBUTE_REGEX, '').trim() !== '') {
        return raw;
    }
    const attributes: string[] = [];
    let attrMatch: RegExpExecArray | null;
    XML_ATTRIBUTE_REGEX.lastIndex = 0;
    while ((attrMatch = XML_ATTRIBUTE_REGEX.exec(match[2])) !== null) {
        attributes.push(`${attrMatch[1]}=${attrMatch[2]}`);
    }
    const attributeText = attributes.length > 0 ? ' ' + attributes.join(' ') : '';
    return `<${match[1]}${attributeText}${match[3] ? ' />' : '>'}`;
}
