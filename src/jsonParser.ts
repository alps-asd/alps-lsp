import * as jsonc from 'jsonc-parser';

export function parseJson(content: string): unknown | null {
    const errors: jsonc.ParseError[] = [];
    const value = jsonc.parse(content, errors, { allowTrailingComma: true });
    return errors.length === 0 ? value : null;
}
