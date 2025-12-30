import * as path from 'path'
import * as url from 'url';
import { promises as fs } from 'fs'
import { FileType, recursiveDirectoryCopy } from '@zoltu/file-copier'

const directoryOfThisFile = path.dirname(url.fileURLToPath(import.meta.url))

const dependencyPaths = [
	{ packageName: 'preact', subfolderToVendor: '.', mainEntrypointFile: 'preact.mjs', alternateEntrypoints: { 'jsx-runtime': 'jsx-runtime/dist/jsxRuntime.mjs', 'hooks': 'hooks/dist/hooks.mjs', 'debug': 'debug/dist/debug.mjs', 'devtools': 'devtools/dist/devtools.mjs' } },
	{ packageName: '@preact/signals', subfolderToVendor: '.', mainEntrypointFile: 'dist/signals.mjs', alternateEntrypoints: {} },
	{ packageName: '@preact/signals-core', subfolderToVendor: '.', mainEntrypointFile: 'dist/signals-core.mjs', alternateEntrypoints: {} },
	{ packageName: 'funtypes', subfolderToVendor: 'lib', mainEntrypointFile: 'index.mjs', alternateEntrypoints: {} },
	{ packageName: '@noble/hashes', subfolderToVendor: '.', mainEntrypointFile: 'index.js', alternateEntrypoints: { 'sha3.js': 'sha3.js', 'sha3': 'sha3.js', 'pbkdf2.js': 'pbkdf2.js', 'sha2.js': 'sha2.js', 'hmac.js': 'hmac.js', 'utils.js': 'utils.js', 'legacy.js': 'legacy.js', 'webcrypto.js': 'webcrypto.js' } },
	{ packageName: '@noble/curves', subfolderToVendor: '.', mainEntrypointFile: 'index.js', alternateEntrypoints: { 'secp256k1.js': 'secp256k1.js', 'utils.js': 'utils.js' } },
	{ packageName: '@noble/secp256k1', subfolderToVendor: '.', mainEntrypointFile: 'index.js', alternateEntrypoints: {} },
	{ packageName: '@scure/bip32', subfolderToVendor: '.', mainEntrypointFile: 'index.js', alternateEntrypoints: {} },
	{ packageName: '@scure/base', subfolderToVendor: '.', mainEntrypointFile: 'index.js', alternateEntrypoints: {} },
	{ packageName: '@scure/bip39', subfolderToVendor: '.', mainEntrypointFile: 'index.js', alternateEntrypoints: { 'wordlists/english.js': 'wordlists/english.js' } },
	{ packageName: 'micro-eth-signer', subfolderToVendor: '.', mainEntrypointFile: 'index.js', alternateEntrypoints: { 'utils.js': 'utils.js', 'advanced/abi.js': 'advanced/abi.js' } },
	{ packageName: 'micro-packed', subfolderToVendor: '.', mainEntrypointFile: 'index.js', alternateEntrypoints: {} },
	{ packageName: '@zoltu/ethereum-ledger', subfolderToVendor: 'output-es', mainEntrypointFile: 'index.js', alternateEntrypoints: {} },
	// { packageName: '', subfolderToVendor: '', entrypointFile: '', alternateEntrypoints: {} },
]

async function vendorDependencies() {
	for (const { packageName, subfolderToVendor } of dependencyPaths) {
		const sourceDirectoryPath = path.join(directoryOfThisFile, '..', 'node_modules', packageName, subfolderToVendor)
		const destinationDirectoryPath = path.join(directoryOfThisFile, '..', 'app', 'vendor', packageName)
		async function inclusionPredicate(path: string, fileType: FileType) {
			if (path.endsWith('.js')) return true
			if (path.endsWith('.ts')) return true
			if (path.endsWith('.mjs')) return true
			if (path.endsWith('.mts')) return true
			if (path.endsWith('.map')) return true
			if (path.endsWith('.git') || path.endsWith('.git/') || path.endsWith('.git\\')) return false
			if (path.endsWith('node_modules') || path.endsWith('node_modules/') || path.endsWith('node_modules\\')) return false
			if (fileType === 'directory') return true
			return false
		}
		await recursiveDirectoryCopy(sourceDirectoryPath, destinationDirectoryPath, inclusionPredicate)
	}

	const indexHtmlPath = path.join(directoryOfThisFile, '..', 'app', 'index.html')
	const oldIndexHtml = await fs.readFile(indexHtmlPath, 'utf8')
	const importmap = dependencyPaths.reduce((importmap, { packageName, mainEntrypointFile, alternateEntrypoints }) => {
		importmap.imports[packageName] = `./vendor/${packageName}/${mainEntrypointFile}`
		for (const [alternateEntrypointName, alternateEntrypointFile] of Object.entries(alternateEntrypoints)) {
			importmap.imports[`${packageName}/${alternateEntrypointName}`] = `./vendor/${packageName}/${alternateEntrypointFile}`
		}
		return importmap
	}, { imports: {} as Record<string, string> })
	const importmapJson = JSON.stringify(importmap, undefined, '\t')
		.replace(/^/mg, '\t\t')
	const newIndexHtml = oldIndexHtml.replace(/<script type='importmap'>[\s\S]*?<\/script>/m, `<script type='importmap'>\n${importmapJson}\n\t</script>`)
	await fs.writeFile(indexHtmlPath, newIndexHtml)
}

vendorDependencies().catch(error => {
	console.error(error)
	debugger
	process.exit(1)
})
