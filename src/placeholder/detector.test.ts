import {describe, it, expect} from 'vitest';
import {scanDocument} from './detector';

describe('scanDocument', () => {
	it('detects a basic (insert ... ) placeholder', () => {
		const content = 'Some text (insert alex hormozi value equation here) more text';
		const matches = scanDocument(content, false, 0);
		expect(matches).toHaveLength(1);
		expect(matches[0]!.query).toBe('alex hormozi value equation here');
		expect(matches[0]!.fullMatch).toBe('(insert alex hormozi value equation here)');
	});

	it('detects placeholder with words after "here"', () => {
		const content = '(insert a story here about naruto)';
		const matches = scanDocument(content, false, 0);
		expect(matches).toHaveLength(1);
		expect(matches[0]!.query).toBe('a story here about naruto');
	});

	it('detects all trigger words: add, put, include, write, fill in, expand on', () => {
		const triggers = ['add', 'put', 'include', 'write', 'fill in', 'expand on'];
		for (const t of triggers) {
			const content = `(${t} some content here)`;
			const matches = scanDocument(content, false, 0);
			expect(matches).toHaveLength(1);
			expect(matches[0]!.query).toBe('some content here');
		}
	});

	it('detects multiple placeholders and sorts by position', () => {
		const content = 'First (insert thing A here) middle (add thing B here) end';
		const matches = scanDocument(content, false, 0);
		expect(matches).toHaveLength(2);
		expect(matches[0]!.query).toBe('thing A here');
		expect(matches[1]!.query).toBe('thing B here');
		expect(matches[0]!.from).toBeLessThan(matches[1]!.from);
	});

	it('does NOT detect bracket syntax when disabled', () => {
		const content = '[insert something here]';
		const matches = scanDocument(content, false, 0);
		expect(matches).toHaveLength(0);
	});

	it('detects bracket syntax when enabled', () => {
		const content = '[insert something here]';
		const matches = scanDocument(content, true, 0);
		expect(matches).toHaveLength(1);
		expect(matches[0]!.query).toBe('something here');
	});

	it('captures surrounding context when contextChars > 0', () => {
		const content = 'Before text. (insert the thing here) After text.';
		const matches = scanDocument(content, false, 50);
		expect(matches[0]!.contextSnippet).toContain('Before text');
		expect(matches[0]!.contextSnippet).toContain('After text');
	});

	it('returns empty context snippet when contextChars is 0', () => {
		const content = 'Before (insert thing here) after';
		const matches = scanDocument(content, false, 0);
		expect(matches[0]!.contextSnippet).toBe('');
	});

	it('returns correct from/to positions', () => {
		const content = 'abc (insert xyz here) def';
		const matches = scanDocument(content, false, 0);
		expect(matches[0]!.from).toBe(4);
		expect(matches[0]!.to).toBe(4 + '(insert xyz here)'.length);
	});

	it('is case-insensitive', () => {
		const content = '(INSERT something HERE)';
		const matches = scanDocument(content, false, 0);
		expect(matches).toHaveLength(1);
	});

	it('returns empty array when no placeholders found', () => {
		const content = 'Just a regular note with no placeholders.';
		const matches = scanDocument(content, false, 0);
		expect(matches).toHaveLength(0);
	});

	it('trims whitespace from query', () => {
		const content = '(insert   spaced query   here)';
		const matches = scanDocument(content, false, 0);
		expect(matches[0]!.query).toBe('spaced query   here');
	});
});
