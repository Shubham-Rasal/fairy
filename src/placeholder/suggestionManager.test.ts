import {describe, it, expect, vi, beforeEach} from 'vitest';
import {SuggestionManager} from './suggestionManager';
import type {PlaceholderMatch} from './detector';

// Mock geminiClient so no real HTTP calls happen
vi.mock('./geminiClient', () => ({
	generate: vi.fn().mockResolvedValue('mocked generated content'),
}));

import {generate} from './geminiClient';
const mockGenerate = vi.mocked(generate);

const config = {
	apiKey: 'test-key',
	model: 'gemini-2.0-flash',
	temperature: 0.3,
	maxOutputTokens: 300,
};

function makeMatch(overrides: Partial<PlaceholderMatch> = {}): PlaceholderMatch {
	return {
		query: 'some concept',
		fullMatch: '(insert some concept here)',
		from: 10,
		to: 36,
		contextSnippet: 'surrounding text',
		...overrides,
	};
}

const mockResult = { content: 'mocked generated content', webSources: [] };

beforeEach(() => {
	mockGenerate.mockReset();
	mockGenerate.mockResolvedValue(mockResult);
});

describe('SuggestionManager', () => {
	it('starts with no active suggestions', () => {
		const manager = new SuggestionManager();
		expect(manager.getSuggestions()).toHaveLength(0);
	});

	it('transitions a placeholder through generating → awaiting after processMatches', async () => {
		const manager = new SuggestionManager();
		const match = makeMatch();

		await manager.processMatches([match], config, false);

		const suggestions = manager.getSuggestions();
		expect(suggestions).toHaveLength(1);
		expect(suggestions[0]!.state).toBe('awaiting');
		expect(suggestions[0]!.generatedContent).toBe('mocked generated content');
		expect(suggestions[0]!.webSources).toEqual([]);
	});

	it('calls generate with the query and context', async () => {
		const manager = new SuggestionManager();
		await manager.processMatches([makeMatch({contextSnippet: 'my context'})], config, true);

		expect(mockGenerate).toHaveBeenCalledWith(
			config,
			'some concept',
			'my context',
			expect.anything(),
			''
		);
	});

	it('does NOT pass context when showContext is false', async () => {
		const manager = new SuggestionManager();
		await manager.processMatches([makeMatch()], config, false);

		expect(mockGenerate).toHaveBeenCalledWith(config, 'some concept', '', expect.anything(), '');
	});

	it('passes vault context when provided in vaultContextMap', async () => {
		const manager = new SuggestionManager();
		const match = makeMatch();
		const vaultContextMap = new Map([[match.fullMatch, 'relevant vault note content']]);
		await manager.processMatches([match], config, false, vaultContextMap);

		expect(mockGenerate).toHaveBeenCalledWith(
			config, 'some concept', '', expect.anything(), 'relevant vault note content'
		);
	});

	it('deduplicates: does not re-generate an already-awaiting suggestion', async () => {
		const manager = new SuggestionManager();
		const match = makeMatch();

		await manager.processMatches([match], config, false);
		await manager.processMatches([match], config, false);

		expect(mockGenerate).toHaveBeenCalledTimes(1);
	});

	it('calls replaceRange on accept and marks state as accepted', async () => {
		const manager = new SuggestionManager();
		await manager.processMatches([makeMatch()], config, false);

		const suggestion = manager.getSuggestions()[0]!;
		const replaceRange = vi.fn();
		manager.accept(suggestion.id, replaceRange);

		expect(replaceRange).toHaveBeenCalledWith('mocked generated content', 10, 36);
		expect(manager.getSuggestions()).toHaveLength(0); // accepted ones filtered out
	});

	it('marks state as rejected on reject and does not call replaceRange', async () => {
		const manager = new SuggestionManager();
		await manager.processMatches([makeMatch()], config, false);

		const suggestion = manager.getSuggestions()[0]!;
		manager.reject(suggestion.id);

		expect(manager.getSuggestions()).toHaveLength(0);
	});

	it('dismissAll dismisses all pending suggestions', async () => {
		const manager = new SuggestionManager();
		await manager.processMatches([makeMatch({from: 0, to: 10}), makeMatch({from: 20, to: 30, fullMatch: '(insert other here)'})], config, false);

		manager.dismissAll();
		expect(manager.getSuggestions()).toHaveLength(0);
	});

	it('notifies listeners on state changes', async () => {
		const manager = new SuggestionManager();
		const listener = vi.fn();
		manager.onChange(listener);

		await manager.processMatches([makeMatch()], config, false);

		// at minimum called once when awaiting state is reached
		expect(listener).toHaveBeenCalled();
	});

	it('unsubscribes listener correctly', async () => {
		const manager = new SuggestionManager();
		const listener = vi.fn();
		const unsub = manager.onChange(listener);
		unsub();
		listener.mockReset();

		await manager.processMatches([makeMatch()], config, false);
		expect(listener).not.toHaveBeenCalled();
	});

	it('dismisses the suggestion on generate error', async () => {
		mockGenerate.mockRejectedValueOnce(new Error('network failure'));

		const manager = new SuggestionManager();
		await manager.processMatches([makeMatch()], config, false);

		expect(manager.getSuggestions()).toHaveLength(0);
	});

	it('does nothing on accept if state is not awaiting', async () => {
		const manager = new SuggestionManager();
		const replaceRange = vi.fn();
		manager.accept('nonexistent-id', replaceRange);
		expect(replaceRange).not.toHaveBeenCalled();
	});

	it('does not re-generate a rejected suggestion with the same text', async () => {
		const manager = new SuggestionManager();
		const match = makeMatch();

		await manager.processMatches([match], config, false);
		const suggestion = manager.getSuggestions()[0]!;
		manager.reject(suggestion.id);

		// Second trigger with same placeholder text — should NOT call generate again
		mockGenerate.mockReset();
		await manager.processMatches([match], config, false);
		expect(mockGenerate).not.toHaveBeenCalled();
	});

	it('re-generates if placeholder text changes after rejection', async () => {
		const manager = new SuggestionManager();

		await manager.processMatches([makeMatch({fullMatch: '(insert naruto story here)'})], config, false);
		const suggestion = manager.getSuggestions()[0]!;
		manager.reject(suggestion.id);

		// Different fullMatch text — should trigger a new generation
		mockGenerate.mockReset();
		mockGenerate.mockResolvedValue({ content: 'new content', webSources: [] });
		await manager.processMatches([makeMatch({fullMatch: '(insert sasuke story here)'})], config, false);
		expect(mockGenerate).toHaveBeenCalledTimes(1);
	});

	it('updates position of rejected suggestion when document shifts', async () => {
		const manager = new SuggestionManager();
		const match = makeMatch({from: 10, to: 36});

		await manager.processMatches([match], config, false);
		manager.reject(manager.getSuggestions()[0]!.id);

		// Same text but shifted position — position should update, no regeneration
		mockGenerate.mockReset();
		await manager.processMatches([makeMatch({from: 20, to: 46})], config, false);
		expect(mockGenerate).not.toHaveBeenCalled();
	});
});
