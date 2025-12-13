export function getOpenTag(text: string, currentPosition: number): string | null {
    let depth = 0;
    for (let i = currentPosition - 1; i >= 0; i--) {
        if (text[i] === '>') {
            // Scan backward to find the opening '<'
            let tagStart = i;
            while (tagStart > 0 && text[tagStart - 1] !== '<') {
                tagStart--;
            }
            if (tagStart > 0) {
                tagStart--; // Include the '<'
                const tagContent = text.slice(tagStart, i + 1);

                // Skip comments, DOCTYPE, and processing instructions
                if (tagContent.startsWith('<!--') || tagContent.startsWith('<!') || tagContent.startsWith('<?')) {
                    continue;
                }

                // Check if it's a closing tag
                const closeTagMatch = tagContent.match(/^<\/([A-Za-z_][A-Za-z0-9_.:-]*)\s*>$/);
                if (closeTagMatch) {
                    depth++;
                    continue;
                }

                // Check if it's a self-closing tag
                if (tagContent.endsWith('/>')) {
                    continue;
                }

                // Check if it's an opening tag
                const openTagMatch = tagContent.match(/^<([A-Za-z_][A-Za-z0-9_.:-]*)/);
                if (openTagMatch) {
                    if (depth === 0) {
                        return openTagMatch[1];
                    }
                    depth--;
                }
            }
        }
    }
    return null;
}
