import {App, PluginSettingTab, Setting, Notice} from "obsidian";
import FairyPlugin from "./main";

export interface FairyPluginSettings {
	enabled: boolean;
	geminiApiKey: string;
	geminiModel: string;
	geminiTemperature: number;
	geminiMaxTokens: number;
	triggerMode: 'idle' | 'command';
	idleDebounceMs: number;
	supportBracketSyntax: boolean;
	showContextInPrompt: boolean;
	contextChars: number;
	useVaultContext: boolean;
}

export const DEFAULT_SETTINGS: FairyPluginSettings = {
	enabled: true,
	geminiApiKey: '',
	geminiModel: 'gemini-2.0-flash',
	geminiTemperature: 0.3,
	geminiMaxTokens: 800,
	triggerMode: 'idle',
	idleDebounceMs: 1200,
	supportBracketSyntax: false,
	showContextInPrompt: true,
	contextChars: 200,
	useVaultContext: true,
}

export class FairySettingTab extends PluginSettingTab {
	plugin: FairyPlugin;

	constructor(app: App, plugin: FairyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		containerEl.createEl('h2', {text: 'Gemini API'});

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('Your Google AI Studio API key')
			.addText(text => text
				.setPlaceholder('AIza...')
				.setValue(this.plugin.settings.geminiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.geminiApiKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Gemini model to use')
			.addText(text => text
				.setValue(this.plugin.settings.geminiModel)
				.onChange(async (value) => {
					this.plugin.settings.geminiModel = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Test Connection')
			.setDesc('Verify your API key works')
			.addButton(btn => btn
				.setButtonText('Test')
				.onClick(async () => {
					if (!this.plugin.settings.geminiApiKey) {
						new Notice('Please enter an API key first');
						return;
					}
					btn.setButtonText('Testing...');
					btn.setDisabled(true);
					try {
						const {testConnection} = await import('./placeholder/geminiClient');
						const ok = await testConnection(this.plugin.settings.geminiApiKey, this.plugin.settings.geminiModel);
						new Notice(ok ? '✓ Gemini connected' : '✗ Connection failed');
					} catch (e) {
						new Notice('✗ ' + (e as Error).message);
					} finally {
						btn.setButtonText('Test');
						btn.setDisabled(false);
					}
				}));

		containerEl.createEl('h2', {text: 'Detection'});

		new Setting(containerEl)
			.setName('Trigger mode')
			.setDesc('"Idle" fills placeholders automatically after you stop typing. "Command" requires manual trigger.')
			.addDropdown(drop => drop
				.addOption('idle', 'On idle (automatic)')
				.addOption('command', 'Command only')
				.setValue(this.plugin.settings.triggerMode)
				.onChange(async (value) => {
					this.plugin.settings.triggerMode = value as 'idle' | 'command';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Idle delay (ms)')
			.setDesc('How long to wait after typing stops before triggering (idle mode only)')
			.addSlider(slider => slider
				.setLimits(500, 5000, 100)
				.setValue(this.plugin.settings.idleDebounceMs)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.idleDebounceMs = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Support bracket syntax')
			.setDesc('Also detect [insert ... here] in addition to (insert ... here)')
			.addToggle(tog => tog
				.setValue(this.plugin.settings.supportBracketSyntax)
				.onChange(async (value) => {
					this.plugin.settings.supportBracketSyntax = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h2', {text: 'Behavior'});

		new Setting(containerEl)
			.setName('Include surrounding context')
			.setDesc('Send text around the placeholder to Gemini for better tone matching')
			.addToggle(tog => tog
				.setValue(this.plugin.settings.showContextInPrompt)
				.onChange(async (value) => {
					this.plugin.settings.showContextInPrompt = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Context length (characters)')
			.setDesc('How many characters of surrounding text to include')
			.addSlider(slider => slider
				.setLimits(50, 500, 50)
				.setValue(this.plugin.settings.contextChars)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.contextChars = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Max tokens')
			.setDesc('Maximum length of generated content')
			.addSlider(slider => slider
				.setLimits(50, 2000, 50)
				.setValue(this.plugin.settings.geminiMaxTokens)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.geminiMaxTokens = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Use vault context (qmd)')
			.setDesc('Search your local vault notes with qmd and include relevant excerpts in the prompt')
			.addToggle(tog => tog
				.setValue(this.plugin.settings.useVaultContext)
				.onChange(async (value) => {
					this.plugin.settings.useVaultContext = value;
					await this.plugin.saveSettings();
				}));
	}
}
