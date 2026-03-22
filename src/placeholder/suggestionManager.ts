import {Notice} from 'obsidian';
import {PlaceholderMatch} from './detector';
import {generate, GeminiConfig, WebSource} from './geminiClient';

export type SuggestionState = 'generating' | 'awaiting' | 'accepted' | 'rejected' | 'dismissed';

export interface PlaceholderSuggestion {
	id: string;
	query: string;
	fullMatch: string;
	from: number;
	to: number;
	contextSnippet: string;
	generatedContent: string | null;
	state: SuggestionState;
	webSources: WebSource[];
	usedVaultContext: boolean;
}

type ChangeListener = () => void;

function hashMatch(match: PlaceholderMatch): string {
	return match.fullMatch;
}

export class SuggestionManager {
	private suggestions: Map<string, PlaceholderSuggestion> = new Map();
	private abortControllers: Map<string, AbortController> = new Map();
	private listeners: Set<ChangeListener> = new Set();

	onChange(fn: ChangeListener): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private notify() {
		for (const fn of this.listeners) fn();
	}

	getSuggestions(): PlaceholderSuggestion[] {
		return Array.from(this.suggestions.values()).filter(
			s => s.state === 'generating' || s.state === 'awaiting'
		);
	}

	async processMatches(matches: PlaceholderMatch[], config: GeminiConfig, showContext: boolean, vaultContextMap?: Map<string, string>) {
		for (const match of matches) {
			const id = hashMatch(match);
			const existing = this.suggestions.get(id);
			if (existing && (existing.state === 'generating' || existing.state === 'awaiting' || existing.state === 'rejected')) {
				// Update position in case document shifted, but don't regenerate
				if (existing) {
					existing.from = match.from;
					existing.to = match.to;
				}
				continue;
			}

			const suggestion: PlaceholderSuggestion = {
				id,
				query: match.query,
				fullMatch: match.fullMatch,
				from: match.from,
				to: match.to,
				contextSnippet: match.contextSnippet,
				generatedContent: null,
				state: 'generating',
				webSources: [],
				usedVaultContext: false,
			};
			this.suggestions.set(id, suggestion);
			this.notify();

			const controller = new AbortController();
			this.abortControllers.set(id, controller);
			const timeout = setTimeout(() => controller.abort(), 30000);

			try {
				const context = showContext ? match.contextSnippet : '';
				const vaultCtx = vaultContextMap?.get(id) ?? '';
				const result = await generate(config, match.query, context, controller.signal, vaultCtx);
				clearTimeout(timeout);
				const current = this.suggestions.get(id);
				if (current && current.state === 'generating') {
					current.generatedContent = result.content;
					current.webSources = result.webSources;
					current.usedVaultContext = vaultCtx.length > 0;
					current.state = 'awaiting';
					this.notify();
				}
			} catch (e) {
				clearTimeout(timeout);
				const err = e as Error;
				if (err.name !== 'AbortError') {
					new Notice('Fairy: ' + err.message);
				}
				const current = this.suggestions.get(id);
				if (current && current.state === 'generating') {
					current.state = 'dismissed';
					this.notify();
				}
			} finally {
				this.abortControllers.delete(id);
			}
		}
	}

	accept(id: string, replaceRange: (content: string, from: number, to: number) => void) {
		const s = this.suggestions.get(id);
		if (!s || s.state !== 'awaiting' || !s.generatedContent) return;
		replaceRange(s.generatedContent, s.from, s.to);
		s.state = 'accepted';
		this.notify();
	}

	reject(id: string) {
		const s = this.suggestions.get(id);
		if (!s) return;
		s.state = 'rejected';
		this.abortControllers.get(id)?.abort();
		this.notify();
	}

	dismissAll() {
		let changed = false;
		for (const s of this.suggestions.values()) {
			if (s.state === 'generating' || s.state === 'awaiting') {
				this.abortControllers.get(s.id)?.abort();
				s.state = 'dismissed';
				changed = true;
			}
		}
		if (changed) this.notify();
	}

	updatePositions(delta: number, fromPos: number) {
		for (const s of this.suggestions.values()) {
			if ((s.state === 'awaiting' || s.state === 'generating') && s.from >= fromPos) {
				s.from += delta;
				s.to += delta;
			}
		}
	}

	clear() {
		this.dismissAll();
		this.suggestions.clear();
	}
}
