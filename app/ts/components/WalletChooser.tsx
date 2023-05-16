import { Signal, useSignal, useSignalEffect } from "@preact/signals"
import { JSX } from "preact/jsx-runtime"
import { encodeTransaction, getAddress, signTransaction } from '@zoltu/ethereum-transactions'
import { mnemonicToSeed, validateMnemonic } from '@zoltu/bip39'
import { wordlist } from '@zoltu/bip39/wordlists/english.js'
import { HDKey } from "@scure/bip32"
import { bytesToBigint, addressBigintToHex } from "@zoltu/ethereum-transactions/converters.js"
import { EthereumClientJsonRpc, EthereumClientWindow, IEthereumClient, Wallet } from "../library/ethereum.js"
import { useAsyncState } from "../library/preact-utilities.js"
import { AutosizingInput } from "./AutosizingInput.js"
import { RpcChooser } from "./RpcChooser.js"
import { Spinner } from "./Spinner.js"
import { AddressPicker } from "./AddressPicker.js"
import { Select } from "./Select.js"

export interface WalletChooserModel {
	readonly wallet: Signal<Wallet | undefined>
	readonly style?: JSX.CSSProperties
}
export function WalletChooser(model: WalletChooserModel) {
	const walletType = useSignal<'readonly' | 'memory' | 'window'>('readonly')
	const onWalletBuilt = (wallet: Wallet) => model.wallet.value = wallet
	return <div>
		<div>
			<Select options={['readonly', 'memory', 'window']} selected={walletType}/>
		</div>
		<div>
		{ walletType.value === 'readonly' ? <ReadonlyWalletBuilder onWalletBuilt={onWalletBuilt}/>
			: walletType.value === 'memory' ? <MemoryWalletBuilder onWalletBuilt={onWalletBuilt}/>
			: walletType.value === 'window' ? <WindowWalletBuilder onWalletBuilt={onWalletBuilt}/>
			: <></>
		}
		</div>
	</div>
}

function ReadonlyWalletBuilder({ onWalletBuilt }: { onWalletBuilt: (wallet: Wallet) => void }) {
	const ethereumClient = useSignal<EthereumClientJsonRpc | undefined>(undefined)
	const address = useSignal<bigint | undefined>(undefined)
	useSignalEffect(() => {
		if (ethereumClient.value === undefined) return
		if (address.value === undefined) return
		onWalletBuilt({ readonly: true, ethereumClient: ethereumClient.value, address: address.value })
	})
	if (ethereumClient.value === undefined) {
		return <RpcChooser ethereumClient={ethereumClient}/>
	} else if (address.value === undefined) {
		return <AddressPicker address={address}/>
	} else {
		return <div>
			<label>{addressBigintToHex(address.value)}&thinsp;</label>
			<button onClick={() => { ethereumClient.value = address.value = undefined }}>Change Wallet</button>
		</div>
	}
}

function WindowWalletBuilder({ onWalletBuilt }: { onWalletBuilt: (wallet: Wallet) => void }) {
	const ethereumClientSignal = useSignal(EthereumClientWindow.tryCreate())
	const ethereumClient = ethereumClientSignal.value
	if (ethereumClient) {
		const { value: accounts, waitFor: waitForAccounts } = useAsyncState<readonly bigint[]>()
		const requestAccounts = () => {
			const accountsPromise = ethereumClient.requestAccounts()
			accountsPromise.then(x => {
				if (x[0] === undefined) return
				onWalletBuilt({
					readonly: false,
					ethereumClient,
					address: x[0],
					sendTransaction: transaction => ethereumClient.sendTransaction({...transaction, gas: 500000n}),
				})
			})
			waitForAccounts(() => accountsPromise)
		}
		useSignalEffect(requestAccounts)
		function RefreshAccountsButton() {
			return <button onClick={requestAccounts}>Refresh Accounts</button>
		}
		switch (accounts.value.state) {
			case 'inactive': return <div>Unexpected state, please report bug to developer.</div>
			case 'pending': return <div>Loading accounts... <Spinner/></div>
			case 'resolved': return accounts.value.value[0] !== undefined ? <div>Address: <code>{addressBigintToHex(accounts.value.value[0])}</code><RefreshAccountsButton/></div> : <div>No accounts provided by browser wallet.<RefreshAccountsButton/></div>
			case 'rejected': return <div>Error while retrieving accounts from browser wallet: ${accounts.value.error.message}</div>
		}
	} else {
		return <div>No browser wallet detected.</div>
	}
}

function MemoryWalletBuilder({ onWalletBuilt }: { onWalletBuilt: (wallet: Wallet) => void }) {
	const ethereumClientSignal = useSignal<IEthereumClient | undefined>(undefined)
	const privateKeySignal = useSignal<bigint | undefined>(undefined)
	useSignalEffect(() => {
		const ethereumClient = ethereumClientSignal.value
		const privateKey = privateKeySignal.value
		if (ethereumClient === undefined) return
		if (privateKey === undefined) return
		
		const address = getAddress(privateKey)
		onWalletBuilt({ readonly: false, address, ethereumClient, sendTransaction: async transaction => {
			const nonce = await ethereumClient.getTransactionCount(address, 'latest')
			const gasLimit = await ethereumClient.estimateGas(transaction, 'latest')
			const chainId = await ethereumClient.chainId()
			const signedTransaction = await signTransaction({
				type: '1559',
				chainId,
				nonce,
				maxFeePerGas: 100n * 10n**9n,
				maxPriorityFeePerGas: 10n**8n,
				gasLimit,
				...transaction,
				accessList: [],
			}, privateKey)
			const encodedTransaction = encodeTransaction(signedTransaction)
			const transactionHash = await ethereumClient.sendRawTransaction(encodedTransaction)
			return {
				transactionHash,
				waitForReceipt: async () => await ethereumClient.getTransactionReceipt(transactionHash)
			}
		}})
	})
	if (ethereumClientSignal.value === undefined) {
		return <RpcChooser ethereumClient={ethereumClientSignal}/>
	} else if (privateKeySignal.value === undefined) {
		return <KeySelector privateKey={privateKeySignal}/>
	} else {
		return <div>
			<label>{addressBigintToHex(getAddress(privateKeySignal.value))}&thinsp;</label>
			<button onClick={() => { ethereumClientSignal.value = privateKeySignal.value = undefined }}>Change Wallet</button>
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
