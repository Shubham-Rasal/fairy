import {Editor, MarkdownView, Notice, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, FairyPluginSettings, FairySettingTab} from './settings';
import {scanDocument} from './placeholder/detector';
import {SuggestionManager} from './placeholder/suggestionManager';
import {buildSuggestionPlugin, buildKeyHandler} from './ui/inlineSuggestion';
import {queryVault} from './placeholder/vaultContext';

export default class FairyPlugin extends Plugin {
	settings: FairyPluginSettings;
	private manager: SuggestionManager;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private statusBar: HTMLElement;
	private ribbonIcon: HTMLElement;

	private setStatus(text: string) {
		this.statusBar.setText('✦ ' + text);
	}

	private updateRibbon() {
		if (this.settings.enabled) {
			this.ribbonIcon.removeClass('fairy-ribbon-off');
			this.ribbonIcon.setAttribute('aria-label', 'Fairy: on (click to disable)');
		} else {
			this.ribbonIcon.addClass('fairy-ribbon-off');
			this.ribbonIcon.setAttribute('aria-label', 'Fairy: off (click to enable)');
			this.setStatus('off');
		}
	}

	async onload() {
		await this.loadSettings();

		this.statusBar = this.addStatusBarItem();
		this.setStatus(this.settings.enabled ? 'ready' : 'off');

		this.manager = new SuggestionManager();

		this.manager.onChange(() => {
			if (!this.settings.enabled) return;
			const pending = this.manager.getSuggestions().filter(s => s.state === 'awaiting');
			const generating = this.manager.getSuggestions().filter(s => s.state === 'generating');
			if (generating.length > 0) {
				this.setStatus('searching…');
			} else if (pending.length > 0) {
				this.setStatus(`${pending.length} suggestion${pending.length > 1 ? 's' : ''} ready — Tab ✓ or Esc ✗`);
			} else {
				this.setStatus('ready');
			}
		});

		// Ribbon toggle icon
		this.ribbonIcon = this.addRibbonIcon('wand', 'Fairy', async () => {
			this.settings.enabled = !this.settings.enabled;
			await this.saveSettings();
			this.updateRibbon();
			if (this.settings.enabled) {
				this.setStatus('ready');
				new Notice('Fairy: on');
			} else {
				if (this.debounceTimer) clearTimeout(this.debounceTimer);
				this.manager.dismissAll();
				new Notice('Fairy: off');
			}
		});
		this.updateRibbon();

		// Register CodeMirror extensions
		const getEditor = (): Editor | null => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			return view?.editor ?? null;
		};

		this.registerEditorExtension([
			buildSuggestionPlugin(this.manager, getEditor),
			buildKeyHandler(this.manager, getEditor),
		]);

		// Idle trigger: watch editor changes
		this.registerEvent(
			this.app.workspace.on('editor-change', (editor: Editor) => {
				if (!this.settings.enabled || this.settings.triggerMode !== 'idle') return;
				if (this.debounceTimer) clearTimeout(this.debounceTimer);
				this.setStatus('waiting…');
				this.debounceTimer = setTimeout(() => {
					void this.fillPlaceholders(editor);
				}, this.settings.idleDebounceMs);
			})
		);

		// Dismiss suggestions on file switch
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.manager.dismissAll();
			})
		);

		// Commands
		this.addCommand({
			id: 'fill-placeholders',
			name: 'Fill all placeholders in current note',
			editorCheckCallback: (checking, editor) => {
				if (checking) return true;
				void this.fillPlaceholders(editor);
				return true;
			}
		});

		this.addCommand({
			id: 'toggle-enabled',
			name: 'Toggle on/off',
			callback: async () => {
				this.settings.enabled = !this.settings.enabled;
				await this.saveSettings();
				this.updateRibbon();
				if (this.settings.enabled) {
					this.setStatus('ready');
					new Notice('Fairy: on');
				} else {
					if (this.debounceTimer) clearTimeout(this.debounceTimer);
					this.manager.dismissAll();
					new Notice('Fairy: off');
				}
			}
		});

		this.addSettingTab(new FairySettingTab(this.app, this));
	}

	private async fillPlaceholders(editor: Editor) {
		if (!this.settings.enabled) return;

		if (!this.settings.geminiApiKey) {
			this.setStatus('no API key');
			new Notice('Fairy: Add your Gemini API key in plugin settings');
			return;
		}

		const content = editor.getValue();
		const matches = scanDocument(
			content,
			this.settings.supportBracketSyntax,
			this.settings.showContextInPrompt ? this.settings.contextChars : 0
		);

		if (matches.length === 0) {
			this.setStatus('ready');
			return;
		}

		const label = matches.length === 1
			? `"${matches[0]!.query.slice(0, 30)}"`
			: `${matches.length} placeholders`;

		this.setStatus(`searching ${label}…`);

		const config = {
			apiKey: this.settings.geminiApiKey,
			model: this.settings.geminiModel,
			temperature: this.settings.geminiTemperature,
			maxOutputTokens: this.settings.geminiMaxTokens,
		};

		// Build vault context map keyed by suggestion id (fullMatch)
		let vaultContextMap: Map<string, string> | undefined;
		if (this.settings.useVaultContext) {
			vaultContextMap = new Map();
			await Promise.all(matches.map(async (match) => {
				const ctx = await queryVault(match.query);
				if (ctx) vaultContextMap!.set(match.fullMatch, ctx);
			}));
		}

		try {
			await this.manager.processMatches(matches, config, this.settings.showContextInPrompt, vaultContextMap);
			const pending = this.manager.getSuggestions().filter(s => s.state === 'awaiting');
			if (pending.length > 0) {
				this.setStatus(`${pending.length} suggestion${pending.length > 1 ? 's' : ''} ready — Tab to accept`);
			} else {
				this.setStatus('ready');
			}
		} catch {
			this.setStatus('error — check console');
		}
	}

	onunload() {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.manager.clear();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<FairyPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
