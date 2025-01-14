import path from 'node:path';
import {promises as fs} from 'node:fs';
import os from 'node:os';

import * as glob from 'glob';

const RULES_DOC_FOLDER = './docs/rules';
const FILE_PREFIX = 'autogen-';

async function buildErrorCodesDocumentation() {
	const {getAllRules} = await import(`${process.env.GPLINT_PATH ?? '../../gplint'}/src/rules.js`)
	const rules = await getAllRules();

	await fs.mkdir(RULES_DOC_FOLDER, {recursive: true});

	const previousRulesDocs = glob.sync(`${RULES_DOC_FOLDER}/${FILE_PREFIX}*.md`);

	await Promise.all(previousRulesDocs.map(f => fs.unlink(f)));

	return Promise.all(Object.entries(rules).filter(([, rule]) => (rule as any).documentation)
		.map(([name, rule]) => generateDocumentationFiles(name, rule)));
}

async function generateDocumentationFiles(name: string, rule: any) {
	const ruleDoc = rule.documentation;
	const fixable = rule.fix !== undefined;

	const lines = [
		'---',
		`slug: ${name}`,
		`title: ${[name, ruleDoc.configuration?.length > 0 ? '⚙️' : undefined, fixable ? '🪄' : undefined].filter(i => i).join(' ')}`,
		'---',
		`# ${name}${fixable ? ' 🪄' : ''}`,
		ruleDoc.description,
		'',
	];

	if (ruleDoc.configuration) {
		lines.push('## Configuration');

		const hasName = ruleDoc.configuration.find(c => Object.keys(c).includes('name'));
		const hasType = ruleDoc.configuration.find(c => Object.keys(c).includes('type'));
		const hasDescription = ruleDoc.configuration.find(c => Object.keys(c).includes('description'));
		const hasDefault = ruleDoc.configuration.find(c => Object.keys(c).includes('default'));

		const headerCells: string[] = [];
		if (hasName) {
			headerCells.push('Name');
		}
		if (hasType) {
			headerCells.push('Type');
		}
		if (hasDescription) {
			headerCells.push('Description');
		}
		if (hasDefault) {
			headerCells.push('Default');
		}

		lines.push(`| ${headerCells.join(' | ')} |`);
		lines.push(`|${headerCells.map(h => '-'.repeat(h.length + 2)).join('|')}|`);

		for (const config of ruleDoc.configuration) {
			const rowCells: string[] = [];
			if (hasName) {
				rowCells.push(`\`${sanitizeTableCell(config.name)}\``);
			}
			if (hasType) {
				rowCells.push(`\`${sanitizeTableCell(config.type)}\``);
			}
			if (hasDescription) {
				rowCells.push(sanitizeTableCell(config.description));
			}
			if (hasDefault) {
				rowCells.push(sanitizeTableCell(parseDefaultValue(config.default)));
			}

			if (config.link) {
				const anchorId = typeof config.link === 'string' ? config.link : config.name;

				//rowCells[0] += ` [🔗](#${anchorId})`;
				rowCells[0] = `[${rowCells[0]}](#${anchorId})`;
			}

			lines.push(`| ${rowCells.join(' | ')} |`);
		}
	}

	const examplesBlock = [];

	if (ruleDoc.examples.length > 0) {
		lines.push('## Examples');
		lines.push('');

		for (const {
			title,
			description,
			config
		} of ruleDoc.examples) {
			examplesBlock.push([
				`### ${title}`,
				`> ${description.split(os.EOL).join(`${os.EOL}> `)}`,
				'```json',
				JSON.stringify(config, null, 2),
				'```',
			].join(os.EOL));
		}

		lines.push(examplesBlock.join(os.EOL));
	}

	lines.push(os.EOL);

	await fs.writeFile(path.join(RULES_DOC_FOLDER, `${FILE_PREFIX}${name}.md`), lines.join(os.EOL));
}

function sanitizeTableCell(text: string): string {
	return text?.replaceAll('|', '\\|');
}

function parseDefaultValue(text: string | number | boolean | object): string {
	if (typeof text === 'object') {
		return [
			'`',
			JSON.stringify(text),
			'`',
		].join('');
	}
	return text?.toString();
}

void buildErrorCodesDocumentation()
	.then(() => 'Rules documentation generated successfully.');

