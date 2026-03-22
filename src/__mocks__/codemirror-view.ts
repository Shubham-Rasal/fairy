export class WidgetType {
	eq(_other: WidgetType): boolean { return false; }
	toDOM(): HTMLElement { return document.createElement('span'); }
	ignoreEvent(): boolean { return true; }
}

export const Decoration = {
	mark: (spec: unknown) => spec,
	widget: (spec: unknown) => spec,
};

export class ViewPlugin {
	static fromClass(_cls: unknown, _spec?: unknown) { return {}; }
}

export class EditorView {
	static domEventHandlers(_handlers: unknown) { return {}; }
}

export class DecorationSet {}

export class ViewUpdate {}
