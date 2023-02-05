import { Signal, useSignal, useSignalEffect } from "@preact/signals"
import { JSX } from "preact/jsx-runtime"
import { getAddress } from '@zoltu/ethereum-transactions'
import { mnemonicToSeed, validateMnemonic } from '@zoltu/bip39'
import { wordlist } from '@zoltu/bip39/wordlists/english.js'
import { HDKey } from "@scure/bip32"
import { bytesToBigint, addressBigintToHex } from "@zoltu/ethereum-transactions/converters.js"
import { Provider, Wallet } from "../library/ethereum.js"
import { useAsyncState } from "../library/preact-utilities.js"
import { AutosizingInput } from "./AutosizingInput.js"
import { RpcChooser } from "./RpcChooser.js"
import { Spinner } from "./Spinner.js"

export interface WalletChooserModel {
	readonly wallet: Signal<Wallet | undefined>
	readonly style?: JSX.CSSProperties
}
export function WalletChooser(model: WalletChooserModel) {
	return <MemoryWalletBuilder onWalletBuilt={wallet => model.wallet.value = wallet}/>
}

function MemoryWalletBuilder({ onWalletBuilt }: { onWalletBuilt: (wallet: Wallet) => void }) {
	const provider = useSignal<Provider | undefined>(undefined)
	const privateKey = useSignal<bigint | undefined>(undefined)
	useSignalEffect(() => {
		if (provider.value === undefined) return
		if (privateKey.value === undefined) return
		
		const address = getAddress(privateKey.value)
		onWalletBuilt({ address, privateKey: privateKey.value, provider: provider.value })
	})
	if (provider.value === undefined) {
		return <RpcChooser provider={provider}/>
	} else if (privateKey.value === undefined) {
		return <KeySelector privateKey={privateKey}/>
	} else {
		return <div>
			<label>{addressBigintToHex(getAddress(privateKey.value))}&thinsp;</label>
			<button onClick={() => { provider.value = privateKey.value = undefined }}>Change Wallet</button>
		</div>
	}
}

function KeySelector({ privateKey }: { privateKey: Signal<bigint | undefined> }) {
	const seed = useSignal<Uint8Array | undefined>(undefined)
	if (privateKey.value !== undefined) {
		return <button onClick={() => privateKey.value = seed.value = undefined}>Change Address</button>
	} else if (seed.value !== undefined) {
		return <DerivationPathPrompt seed={seed.value} privateKey={privateKey}/>
	} else {
		return <MnemonicOrKeyPrompt seed={seed} privateKey={privateKey}/>
	}
}

function MnemonicOrKeyPrompt({ seed, privateKey }: { seed: Signal<Uint8Array | undefined>, privateKey: Signal<bigint | undefined> }) {
	const internalValue = useSignal('')
	const { value, waitFor, reset } = useAsyncState<string>()
	function onClick() {
		waitFor(async () => {
			if (/^0x[a-fA-F0-9]{64}$/.test(internalValue.peek())) {
				privateKey.value = BigInt(internalValue.peek())
			} else if (validateMnemonic(internalValue.peek(), wordlist)) {
				seed.value = await mnemonicToSeed(internalValue.peek())
			} else {
				throw new Error(`${internalValue.peek()} is neither a mnemonic nor a private key.`)
			}
			return internalValue.peek()
		})
	}
	function ChangeButton() {
		return <button onClick={reset}>Change</button>
	}
	switch (value.value.state) {
		case 'inactive': return <div>
			<label>Mnemonic or Private Key&thinsp;
				<AutosizingInput type='password' autocomplete='off' placeholder='zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong' value={internalValue} style={{ maxWidth: '100%', paddingInline: '5px' }}/>
			</label>
			&thinsp;
			<button onClick={onClick}>Next</button>
		</div>
		case 'pending': return <div>Validating {internalValue.value}... <Spinner/></div>
		case 'rejected': return <div><span style={{ color: 'red' }}>{value.value.error.message}</span><ChangeButton/></div>
		case 'resolved': return <div>{internalValue.value} <ChangeButton/></div>
	}
}

function DerivationPathPrompt({ seed, privateKey}: { seed: Uint8Array, privateKey: Signal<bigint | undefined> }) {
	const derivationPath = useSignal(`m/44'/60'/0'/0/0`)
	function onClick() {
		const hdKey = HDKey.fromMasterSeed(seed)
		const derivedHdKey = hdKey.derive(derivationPath.peek())
		const maybePrivateKey = derivedHdKey.privateKey
		if (maybePrivateKey === null) {
			// TODO: figure out if this is actually possible
			throw new Error(`Unexected Error: Private Key missing from HDKey.`)
		}
		privateKey.value = bytesToBigint(maybePrivateKey)
	}
	return <div>
		<label>
			Derivation Path&thinsp;
			<AutosizingInput type='text' pattern="^m(?:\/\d+'?)+$" placeholder="m/44'/60'/0'/0/0" value={derivationPath} style={{ paddingInline: '5px' }} dataList={[`m/44'/60'/0'/0/0`]}/>
		</label>
		&thinsp;
		<button onClick={onClick}>Next</button>
	</div>
}
