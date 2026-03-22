export interface PlaceholderMatch {
	query: string;
	fullMatch: string;
	from: number;
	to: number;
	contextSnippet: string;
}

const PAREN_PATTERN = /\((?:insert|add|put|include|write|fill in|expand on)\s+(.+?)\)/gi;
const BRACKET_PATTERN = /\[(?:insert|add|put|include|write|fill in|expand on)\s+(.+?)\]/gi;

export function scanDocument(
	content: string,
	supportBrackets: boolean,
	contextChars: number
): PlaceholderMatch[] {
	const results: PlaceholderMatch[] = [];
	const patterns = supportBrackets
		? [PAREN_PATTERN, BRACKET_PATTERN]
		: [PAREN_PATTERN];

	for (const pattern of patterns) {
		pattern.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(content)) !== null) {
			const from = match.index;
			const to = from + match[0].length;
			const contextStart = Math.max(0, from - contextChars);
			const contextEnd = Math.min(content.length, to + contextChars);
			const contextSnippet = contextChars > 0 ? content.slice(contextStart, contextEnd) : '';
			results.push({
				query: (match[1] ?? '').trim(),
				fullMatch: match[0],
				from,
				to,
				contextSnippet,
			});
		}
	}

	results.sort((a, b) => a.from - b.from);
	return results;
}
