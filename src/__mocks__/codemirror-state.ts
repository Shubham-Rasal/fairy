export const StateEffect = {
	define: <T>() => ({
		of: (value: T) => ({ value }),
		is: (_e: unknown) => false,
	}),
};

export class RangeSetBuilder<T> {
	private ranges: Array<{from: number; to: number; value: T}> = [];
	add(from: number, to: number, value: T) { this.ranges.push({from, to, value}); }
	finish() { return this.ranges; }
}

export class Transaction {}
