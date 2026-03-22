import {Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate} from '@codemirror/view';
import {RangeSetBuilder, StateEffect, Transaction} from '@codemirror/state';
import {SuggestionManager} from '../placeholder/suggestionManager';
import {SuggestionWidget} from './suggestionWidget';
import type {Editor} from 'obsidian';

export const refreshSuggestionsEffect = StateEffect.define<void>();

export function buildSuggestionPlugin(
	manager: SuggestionManager,
	getEditor: () => Editor | null,
) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			private unsub: () => void;

			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
				this.unsub = manager.onChange(() => {
					view.dispatch({ effects: refreshSuggestionsEffect.of() });
				});
			}

			update(update: ViewUpdate) {
				const hasRefresh = update.transactions.some((tr: Transaction) =>
					tr.effects.some((e) => e.is(refreshSuggestionsEffect))
				);
				if (hasRefresh || update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}

			destroy() {
				this.unsub();
			}

			buildDecorations(view: EditorView): DecorationSet {
				const builder = new RangeSetBuilder<Decoration>();
				const suggestions = manager.getSuggestions();
				const docLength = view.state.doc.length;

				const sorted = [...suggestions].sort((a, b) => a.from - b.from);

				for (const s of sorted) {
					const from = Math.min(s.from, docLength);
					const to = Math.min(s.to, docLength);
					if (from >= to) continue;

					builder.add(from, to, Decoration.mark({
						class: s.state === 'generating' ? 'fairy-placeholder-generating' : 'fairy-placeholder-pending',
					}));

					const widget = new SuggestionWidget(
						s.generatedContent ?? '',
						s.state === 'generating',
						s.webSources,
						s.usedVaultContext,
						() => {
							const editor = getEditor();
							if (!editor) return;
							manager.accept(s.id, (content, f, t) => {
								const doc = view.state.doc;
								const startLine = doc.lineAt(Math.min(f, doc.length));
								const endLine = doc.lineAt(Math.min(t, doc.length));
								editor.replaceRange(
									content,
									{line: startLine.number - 1, ch: f - startLine.from},
									{line: endLine.number - 1, ch: t - endLine.from}
								);
							});
						},
						() => manager.reject(s.id),
					);

					builder.add(to, to, Decoration.widget({widget, side: 1}));
				}

				return builder.finish();
			}
		},
		{ decorations: (v: { decorations: DecorationSet }) => v.decorations }
	);
}

export function buildKeyHandler(manager: SuggestionManager, getEditor: () => Editor | null) {
	return EditorView.domEventHandlers({
		keydown(e: KeyboardEvent, view: EditorView) {
			const pending = manager.getSuggestions().filter(s => s.state === 'awaiting');
			if (pending.length === 0) return false;

			if (e.key === 'Tab') {
				e.preventDefault();
				const s = pending[0];
				if (!s) return false;
				const editor = getEditor();
				if (!editor) return false;
				manager.accept(s.id, (content, f, t) => {
					const doc = view.state.doc;
					const startLine = doc.lineAt(Math.min(f, doc.length));
					const endLine = doc.lineAt(Math.min(t, doc.length));
					editor.replaceRange(
						content,
						{line: startLine.number - 1, ch: f - startLine.from},
						{line: endLine.number - 1, ch: t - endLine.from}
					);
				});
				return true;
			}

			if (e.key === 'Escape') {
				e.preventDefault();
				pending.forEach(s => manager.reject(s.id));
				return true;
			}

			return false;
		}
	});
}
