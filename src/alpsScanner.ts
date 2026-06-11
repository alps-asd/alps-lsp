import * as jsonc from 'jsonc-parser';

/** A single attribute (XML) or property (JSON) string value with its exact document offset. */
export interface ValueToken {
    /** The value without surrounding quotes */
    value: string;
    /** Document offset of the first character of the value (just after the opening quote) */
    offset: number;
}

/** One descriptor occurrence (XML element or JSON object) with its relevant attribute values. */
export interface DescriptorOccurrence {
    id?: ValueToken;
    type?: ValueToken;
    href?: ValueToken;
    rt?: ValueToken;
}

const DESCRIPTOR_ATTRIBUTES = ['id', 'type', 'href', 'rt'] as const;
type DescriptorAttribute = typeof DESCRIPTOR_ATTRIBUTES[number];

function isDescriptorAttribute(name: string): name is DescriptorAttribute {
    return (DESCRIPTOR_ATTRIBUTES as readonly string[]).includes(name);
}

/**
 * Scans an ALPS document for descriptor occurrences (including nested descriptors)
 * and returns their id/type/href/rt values with precise document offsets.
 */
export function scanDescriptors(text: string, languageId: string): DescriptorOccurrence[] {
    if (languageId === 'alps-json') {
        return scanJsonDescriptors(text);
    }
    return scanXmlDescriptors(text);
}

function scanXmlDescriptors(text: string): DescriptorOccurrence[] {
    const occurrences: DescriptorOccurrence[] = [];

    // Blank out comments and CDATA sections (preserving offsets) so that
    // descriptor-like content inside them is ignored.
    const masked = text
        .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
        .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (m) => ' '.repeat(m.length));

    const tagRegex = /<descriptor\b[^>]*/g;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagRegex.exec(masked)) !== null) {
        const tagText = tagMatch[0];
        const occurrence: DescriptorOccurrence = {};
        const attrRegex = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*["']([^"']*)["']/g;
        let attrMatch: RegExpExecArray | null;
        while ((attrMatch = attrRegex.exec(tagText)) !== null) {
            const name = attrMatch[1];
            if (!isDescriptorAttribute(name)) {
                continue;
            }
            // Value starts right after the opening quote (one char before the value end quote)
            const valueOffset = tagMatch.index + attrMatch.index + attrMatch[0].length - attrMatch[2].length - 1;
            occurrence[name] = { value: attrMatch[2], offset: valueOffset };
        }
        occurrences.push(occurrence);
    }
    return occurrences;
}

function scanJsonDescriptors(text: string): DescriptorOccurrence[] {
    const root = jsonc.parseTree(text);
    if (!root) {
        return [];
    }
    const occurrences: DescriptorOccurrence[] = [];
    walkJsonNode(root, occurrences);
    return occurrences;
}

function walkJsonNode(node: jsonc.Node, occurrences: DescriptorOccurrence[]): void {
    if (node.type === 'property' && node.children?.length === 2 && node.children[0].value === 'descriptor') {
        const valueNode = node.children[1];
        const items = valueNode.type === 'array' ? valueNode.children ?? [] : [valueNode];
        for (const item of items) {
            if (item.type === 'object') {
                occurrences.push(readJsonDescriptorObject(item));
            }
        }
    }
    for (const child of node.children ?? []) {
        walkJsonNode(child, occurrences);
    }
}

function readJsonDescriptorObject(node: jsonc.Node): DescriptorOccurrence {
    const occurrence: DescriptorOccurrence = {};
    for (const property of node.children ?? []) {
        if (property.type !== 'property' || property.children?.length !== 2) {
            continue;
        }
        const [keyNode, valueNode] = property.children;
        const key = keyNode.value;
        if (typeof key === 'string' && isDescriptorAttribute(key)
            && valueNode.type === 'string' && typeof valueNode.value === 'string') {
            // valueNode.offset points at the opening quote; the value starts one char later
            occurrence[key] = { value: valueNode.value, offset: valueNode.offset + 1 };
        }
    }
    return occurrence;
}
