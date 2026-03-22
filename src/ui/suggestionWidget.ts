import {WidgetType} from '@codemirror/view';
import type {WebSource} from '../placeholder/geminiClient';

export class SuggestionWidget extends WidgetType {
	constructor(
		private content: string,
		private isGenerating: boolean,
		private webSources: WebSource[],
		private usedVaultContext: boolean,
		private onAccept: () => void,
		private onReject: () => void,
	) {
		super();
	}

	eq(other: SuggestionWidget): boolean {
		return other.content === this.content
			&& other.isGenerating === this.isGenerating
			&& other.webSources.length === this.webSources.length
			&& other.usedVaultContext === this.usedVaultContext;
	}

	toDOM(): HTMLElement {
		const wrap = document.createElement('span');
		wrap.className = 'fairy-suggestion-widget';

		if (this.isGenerating) {
			const spinner = wrap.createSpan({cls: 'fairy-spinner', text: ' ⟳'});
			spinner.title = 'Generating…';
			return wrap;
		}

		wrap.createSpan({cls: 'fairy-suggestion-arrow', text: ' → '});
		wrap.createSpan({cls: 'fairy-suggestion-text', text: this.content});
		wrap.createSpan({text: ' '});

		// Source badges
		if (this.usedVaultContext) {
			const badge = wrap.createSpan({cls: 'fairy-source-badge fairy-source-vault', text: '📓 vault'});
			badge.title = 'Generated using your local vault notes';
		}
		if (this.webSources.length > 0) {
			const badge = wrap.createSpan({cls: 'fairy-source-badge fairy-source-web', text: `🌐 web`});
			const titles = this.webSources.map(s => `• ${s.title}`).join('\n');
			badge.title = `Web sources:\n${titles}`;
		}
		if (!this.usedVaultContext && this.webSources.length === 0) {
			const badge = wrap.createSpan({cls: 'fairy-source-badge fairy-source-model', text: '🧠 model'});
			badge.title = 'Generated from model knowledge only';
		}

		wrap.createSpan({text: ' '});

		const accept = wrap.createEl('button', {cls: 'fairy-accept-btn', text: '✓'});
		accept.title = 'Accept (Tab)';
		const reject = wrap.createEl('button', {cls: 'fairy-reject-btn', text: '✗'});
		reject.title = 'Reject (Esc)';

		accept.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.onAccept();
		});
		reject.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.onReject();
		});

		return wrap;
	}

	ignoreEvent(): boolean {
		return false;
	}
}
