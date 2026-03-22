import {execFile} from 'child_process';

export async function queryVault(query: string, limit = 3): Promise<string> {
	return new Promise((resolve) => {
		execFile(
			'qmd',
			['query', query, '--format', 'markdown', '--limit', String(limit)],
			{timeout: 8000},
			(err, stdout) => {
				if (err || !stdout.trim()) {
					resolve('');
				} else {
					resolve(stdout.trim());
				}
			}
		);
	});
}
