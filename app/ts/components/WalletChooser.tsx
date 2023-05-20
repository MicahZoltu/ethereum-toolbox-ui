import { ReadonlySignal, useSignal, useSignalEffect } from "@preact/signals"
import { JSX } from "preact/jsx-runtime"
import { encodeTransaction, getAddress, signTransaction } from '@zoltu/ethereum-transactions'
import { mnemonicToSeed, validateMnemonic } from '@zoltu/bip39'
import { wordlist } from '@zoltu/bip39/wordlists/english.js'
import { HDKey } from "@scure/bip32"
import { bytesToBigint, addressBigintToHex } from "@zoltu/ethereum-transactions/converters.js"
import { EthereumClientJsonRpc, EthereumClientWindow, IEthereumClient, Wallet } from "../library/ethereum.js"
import { OptionalSignal, useAsyncState, useOptionalSignal } from "../library/preact-utilities.js"
import { AutosizingInput } from "./AutosizingInput.js"
import { RpcChooser } from "./RpcChooser.js"
import { Spinner } from "./Spinner.js"
import { AddressPicker } from "./AddressPicker.js"
import { Select } from "./Select.js"
import { useState } from "preact/hooks"

export interface WalletChooserModel {
	readonly wallet: OptionalSignal<Wallet>
	readonly style?: JSX.CSSProperties
}
export function WalletChooser(model: WalletChooserModel) {
	const walletType = useSignal<'readonly' | 'memory' | 'window'>('readonly')
	useSignalEffect(() => walletType.value && model.wallet.clear())
	return <div>
		<div>
			<Select options={['readonly', 'memory', 'window']} selected={walletType}/>
		</div>
		<div>
		{ walletType.value === 'readonly' ? <ReadonlyWalletBuilder wallet={model.wallet}/>
			: walletType.value === 'memory' ? <MemoryWalletBuilder wallet={model.wallet}/>
			: walletType.value === 'window' ? <WindowWalletBuilder wallet={model.wallet}/>
			: <></>
		}
		</div>
	</div>
}

function ReadonlyWalletBuilder(model: { wallet: OptionalSignal<Wallet> }) {
	const maybeEthereumClient = useOptionalSignal<EthereumClientJsonRpc>(undefined)
	const maybeAddress = useOptionalSignal<bigint>(undefined)
	useSignalEffect(() => { model.wallet.deepValue = maybeEthereumClient.deepValue && maybeAddress.deepValue ? { readonly: true, ethereumClient: maybeEthereumClient.deepValue, address: maybeAddress.deepValue } : undefined })
	if (maybeEthereumClient.value === undefined) {
		return <RpcChooser ethereumClient={maybeEthereumClient}/>
	} else if (maybeAddress.value === undefined) {
		return <AddressPicker address={maybeAddress}/>
	} else {
		return <div>
			<label>{addressBigintToHex(maybeAddress.value.value)}&thinsp;</label>
			<button onClick={() => { maybeEthereumClient.value = maybeAddress.value = undefined }}>Change Wallet</button>
		</div>
	}
}

function WindowWalletBuilder(model: { wallet: OptionalSignal<Wallet> }) {
	const ethereumClientSignal = useOptionalSignal(EthereumClientWindow.tryCreate())
	const ethereumClient = ethereumClientSignal.deepValue
	if (ethereumClient) {
		const { value: asyncAddress, waitFor: waitForAccount } = useAsyncState<bigint | undefined>()
		useSignalEffect(() => {
			if (asyncAddress.value.state !== 'resolved') {
				model.wallet.clear()
			} else if (asyncAddress.value.value === undefined) {
				model.wallet.clear()
			} else {
				const address = asyncAddress.value.value
				model.wallet.deepValue = {
					readonly: false,
					ethereumClient,
					address: address,
					sendTransaction: async transaction => {
						const nonce = await ethereumClient.getTransactionCount(address, 'latest')
						const gas = await ethereumClient.estimateGas(transaction, 'latest')
						const chainId = await ethereumClient.chainId()
						return await ethereumClient.sendTransaction({
							type: '1559',
							chainId,
							nonce,
							maxFeePerGas: 100n * 10n**9n,
							maxPriorityFeePerGas: 10n**8n,
							gas,
							...transaction,
							accessList: [],
						})
					},
				}
			}
		})
		const requestAccounts = () => waitForAccount(async () => {
			const accounts = await ethereumClient.requestAccounts()
			return accounts[0]
		})
		useSignalEffect(requestAccounts)
		const [RefreshAccountsButton] = useState(() => () => <button onClick={requestAccounts}>Refresh Accounts</button>)
		switch (asyncAddress.value.state) {
			case 'inactive': return <div>Unexpected state, please report bug to developer.</div>
			case 'pending': return <div>Loading accounts... <Spinner/></div>
			case 'resolved': return asyncAddress.value.value !== undefined ? <div>Address: <code style={{ display: 'inline-block'}}>{addressBigintToHex(asyncAddress.value.value)}</code> <RefreshAccountsButton/></div> : <div>No accounts provided by browser wallet.<RefreshAccountsButton/></div>
			case 'rejected': return <div>Error while retrieving accounts from browser wallet: ${asyncAddress.value.error.message}</div>
		}
	} else {
		return <div>No browser wallet detected.</div>
	}
}

function MemoryWalletBuilder(model: { wallet: OptionalSignal<Wallet> }) {
	const ethereumClientSignal = useOptionalSignal<IEthereumClient>(undefined)
	const privateKeySignal = useOptionalSignal<bigint>(undefined)
	useSignalEffect(() => {
		const ethereumClient = ethereumClientSignal.deepValue
		const privateKey = privateKeySignal.deepValue
		if (ethereumClient === undefined) {
			model.wallet.clear()
		} else if (privateKey === undefined) {
			model.wallet.clear()
		} else {
			const address = getAddress(privateKey)
			model.wallet.deepValue = ({ readonly: false, address, ethereumClient, sendTransaction: async transaction => {
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
		}
	})
	const [ChangeAccountButton_] = useState(() => () => <button onClick={() => { ethereumClientSignal.value = privateKeySignal.value = undefined }}>Change Wallet</button>)
	if (ethereumClientSignal.value === undefined) {
		return <RpcChooser ethereumClient={ethereumClientSignal}/>
	} else if (privateKeySignal.value === undefined) {
		return <KeySelector privateKey={privateKeySignal}/>
	} else {
		return <div>Address: <code style={{ display: 'inline-block' }}>{addressBigintToHex(getAddress(privateKeySignal.value.value))}</code> <ChangeAccountButton_/></div>
	}
}

function KeySelector({ privateKey }: { privateKey: OptionalSignal<bigint> }) {
	const seed = useOptionalSignal<Uint8Array>(undefined)
	if (privateKey.value !== undefined) {
		return <button onClick={() => privateKey.value = seed.value = undefined}>Change Address</button>
	} else if (seed.value !== undefined) {
		return <DerivationPathPrompt seed={seed.value} privateKey={privateKey}/>
	} else {
		return <MnemonicOrKeyPrompt seed={seed} privateKey={privateKey}/>
	}
}

function MnemonicOrKeyPrompt({ seed, privateKey }: { seed: OptionalSignal<Uint8Array>, privateKey: OptionalSignal<bigint> }) {
	const internalValue = useSignal('')
	const { value, waitFor, reset } = useAsyncState<void>()
	function onClick() {
		waitFor(async () => {
			const internal = internalValue.peek()
			if (/^0x[a-fA-F0-9]{64}$/.test(internal)) {
				privateKey.deepValue = BigInt(internal)
			} else if (validateMnemonic(internal, wordlist)) {
				seed.deepValue = await mnemonicToSeed(internal)
			} else {
				throw new Error(`${internal} is neither a mnemonic nor a private key.`)
			}
		})
	}
	const [ChangeButton] = useState(() => () => <button onClick={reset}>Change</button>)
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

function DerivationPathPrompt({ seed, privateKey}: { seed: ReadonlySignal<Uint8Array>, privateKey: OptionalSignal<bigint> }) {
	const derivationPath = useSignal(`m/44'/60'/0'/0/0`)
	function onClick() {
		const hdKey = HDKey.fromMasterSeed(seed.value)
		const derivedHdKey = hdKey.derive(derivationPath.peek())
		const maybePrivateKey = derivedHdKey.privateKey
		if (maybePrivateKey === null) {
			// TODO: figure out if this is actually possible
			throw new Error(`Unexected Error: Private Key missing from HDKey.`)
		}
		privateKey.deepValue = bytesToBigint(maybePrivateKey)
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
