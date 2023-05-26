import { ReadonlySignal, useSignal, useSignalEffect } from "@preact/signals"
import { HDKey } from "@scure/bip32"
import { mnemonicToSeed, validateMnemonic } from '@zoltu/bip39'
import { wordlist } from '@zoltu/bip39/wordlists/english.js'
import { encodeTransaction, getAddress, signTransaction } from '@zoltu/ethereum-transactions'
import { addressBigintToHex, bytesToBigint } from "@zoltu/ethereum-transactions/converters.js"
import { useState } from "preact/hooks"
import { JSX } from "preact/jsx-runtime"
import { forgetWalletAddress, forgetContractWalletAddress, forgetWindowWalletAddress, rememberContractWalletAddress, rememberWindowWalletAddress, savedContractWallets, savedWindowWallets, savedWallets } from "../library/addresses.js"
import { EthereumClientContract, EthereumClientJsonRpc, EthereumClientWindow, IEthereumClient, Wallet } from "../library/ethereum.js"
import { OptionalSignal, useAsyncState, useOptionalSignal } from "../library/preact-utilities.js"
import { AddressPicker } from "./AddressPicker.js"
import { AutosizingInput } from "./AutosizingInput.js"
import { RpcChooser } from "./RpcChooser.js"
import { Select } from "./Select.js"
import { Spinner } from "./Spinner.js"
import { Refresh } from "./Refresh.js"

export interface WalletChooserModel {
	readonly wallet: OptionalSignal<Wallet>
	readonly style?: JSX.CSSProperties
	readonly class?: JSX.HTMLAttributes['class']
}
export function WalletChooser(model: WalletChooserModel) {
	const walletType = useSignal<'readonly' | 'memory' | 'window' | 'contract'>('readonly')
	const error = useOptionalSignal<string>(undefined)
	useSignalEffect(() => walletType.value && model.wallet.clear())
	const [WalletBuilder_] = useState(() => () => {
		switch (walletType.value) {
			case 'readonly': return <ReadonlyWalletBuilder wallet={model.wallet} error={error}/>
			case 'memory': return <MemoryWalletBuilder wallet={model.wallet} error={error}/>
			case 'window': return <WindowWalletBuilder wallet={model.wallet} error={error}/>
			case 'contract': return <ContractWalletBuilder wallet={model.wallet} error={error}/>
		}
	})
	const [Error_] = useState(() => () => error.deepValue ? <div style={{ color: 'red' }}>{error}</div> : <></>)
	return <div style={model.style} class={model.class}>
		<div><Select options={['readonly', 'memory', 'window', 'contract']} selected={walletType} /><WalletBuilder_/></div>
		<Error_/>
	</div>
}

function ReadonlyWalletBuilder(model: { wallet: OptionalSignal<Wallet>, error: OptionalSignal<string> }) {
	const maybeEthereumClient = useOptionalSignal<EthereumClientJsonRpc>(undefined)
	const maybeAddress = useOptionalSignal<bigint>(undefined)
	useSignalEffect(() => {
		if (!maybeEthereumClient.deepValue || !maybeAddress.deepValue) {
			model.wallet.deepValue = undefined
		} else {
			maybeEthereumClient.deepValue.address = maybeAddress.deepValue
			model.wallet.deepValue = { readonly: true, ethereumClient: maybeEthereumClient.deepValue, address: maybeAddress.deepValue }
		}
	})
	const client = maybeEthereumClient.deepValue
	if (client === undefined) {
		return <RpcChooser ethereumClient={maybeEthereumClient} error={model.error}/>
	} else if (maybeAddress.deepValue === undefined) {
		return <AddressPicker required address={maybeAddress} extraOptions={savedWallets}/>
	} else {
		const address = maybeAddress.deepValue
		const [Rpc_] = useState(() => () => <span>RPC: <code>{client.endpoint}</code></span>)
		const [Address_] = useState(() => () => <span>Address: <code>{addressBigintToHex(address)}</code></span>)
		const [ChangeButton_] = useState(() => () => <button onClick={() => { maybeEthereumClient.clear(); maybeAddress.clear() }} style={{width: '100%'}}>Change</button>)
		const [RememberButton_] = useState(() => () => {
			if (savedWallets.value.includes(address)) {
				return <button onClick={() => forgetWalletAddress(address)} style={{width:'100%'}}>Forget</button>
			} else {
				return <button onClick={() => rememberWindowWalletAddress(address)} style={{width:'100%'}}>Remember</button>
			}
			
		})
		return <div style={{ flexGrow: 1 }}>
			<div style={{ flexGrow: 1, flexDirection: 'column', alignItems: 'flex-start' }}>
				<Rpc_/>
				<Address_/>
			</div>
			<div style={{ flexDirection: 'column' }}>
				<ChangeButton_/>
				<RememberButton_/>
			</div>
		</div>
	}
}

function ContractWalletBuilder(model: { wallet: OptionalSignal<Wallet>, error: OptionalSignal<string> }) {
	const underlyingWallet = useOptionalSignal<Wallet>(undefined)
	const maybeAddress = useOptionalSignal<bigint>(undefined)
	useSignalEffect(() => {
		if (underlyingWallet.deepValue === undefined || maybeAddress.deepValue === undefined) {
			model.wallet.deepValue = undefined
			return
		}
		const ethereumClient = new EthereumClientContract(underlyingWallet.deepValue.ethereumClient, underlyingWallet.deepValue.address, maybeAddress.deepValue)
		model.wallet.deepValue = {
			ethereumClient,
			address: maybeAddress.deepValue,
			...underlyingWallet.deepValue.readonly ? {
				readonly: true
			} : {
				readonly: false,
				sendTransaction: ethereumClient.sendTransaction
			}
		}
	})
	const [ChangeButton_] = useState(() => () => maybeAddress.deepValue ? <button onClick={() => { maybeAddress.deepValue = undefined }} style={{ width: '100%' }}>Change</button> : <></>)
	const [ContractAddress_] = useState(() => () => {
		return (maybeAddress.deepValue === undefined)
			? <AddressPicker required address={maybeAddress} extraOptions={savedContractWallets}/>
			: <>Contract:<code>{addressBigintToHex(maybeAddress.deepValue)}</code></>
	})
	const [OwnerAddress_] = useState(() => () => {
		const { value, waitFor } = useAsyncState<bigint>()
		useSignalEffect(() => {
			const underlyingWallet_ = underlyingWallet.deepValue
			if (underlyingWallet_ === undefined) return
			const address_ = maybeAddress.deepValue
			if (address_ === undefined) return
			waitFor(async () => {
				const ethereumClient = new EthereumClientContract(underlyingWallet_.ethereumClient, underlyingWallet_.address, address_)
				return await ethereumClient.getOwner()
			})
		})
		switch (value.value.state) {
			case 'inactive': return <></>
			case 'pending': return <>Owner: <Spinner/></>
			case 'rejected': return <>Owner: <span style={{color:'red'}}>{value.value.error.message}</span></>
			case 'resolved': return <>Owner: <code>{addressBigintToHex(value.value.value)}</code></>
		}
	})
	const [SignerWallet_] = useState(() => () => {
		return <div style={{ flexDirection: 'column', border: '1px dashed blue', padding: '3px' }}>
			<div>Signer:</div>
			<WalletChooser wallet={underlyingWallet}/>
		</div>
	})
	const [RememberButton_] = useState(()=> () => {
		const address = maybeAddress.deepValue
		if (address === undefined) return <></>
		if (savedContractWallets.value.includes(address)) {
			return <button onClick={() => forgetContractWalletAddress(address)} style={{ width: '100%' }}>Forget</button>
		} else {
			return <button onClick={() => rememberContractWalletAddress(address)} style={{ width: '100%' }}>Remember</button>
		}
	})
	const [ContractWallet_] = useState(() => () => {
		return <div style={{ flexDirection: 'column', border: '1px dashed blue', padding: '3px' }}>
			<div>Contract Wallet:</div>
			<div>
				<div style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
					<div><ContractAddress_/></div>
					<div><OwnerAddress_/></div>
				</div>
				<div style={{ flexDirection: 'column' }}>
					<ChangeButton_/>
					<RememberButton_/>
				</div>
			</div>
		</div>
	})
	return <div style={{ flexGrow: 1, alignItems: 'normal' }}>
		<ContractWallet_/>
		<SignerWallet_/>
	</div>
}

function WindowWalletBuilder(model: { wallet: OptionalSignal<Wallet>, error: OptionalSignal<string> }) {
	const ethereumClientSignal = useOptionalSignal(EthereumClientWindow.tryCreate())
	const ethereumClient = ethereumClientSignal.deepValue
	if (!ethereumClient) return <>No browser wallet detected.</>
	const { value: asyncAddress, waitFor: waitForAccount } = useAsyncState<bigint | undefined>()
	useSignalEffect(() => {
		if (asyncAddress.value.state !== 'resolved') {
			model.wallet.clear()
		} else if (asyncAddress.value.value === undefined) {
			model.wallet.clear()
		} else {
			const address = asyncAddress.value.value
			ethereumClient.address = address
			model.wallet.deepValue = {
				readonly: false,
				ethereumClient,
				address: address,
				sendTransaction: ethereumClient.sendTransaction,
			}
		}
	})
	const requestAccounts = () => waitForAccount(async () => {
		const accounts = await ethereumClient.requestAccounts()
		return accounts[0]
	})
	useSignalEffect(requestAccounts)
	const [RememberButton_] = useState(() => () => {
		if (asyncAddress.value.state !== 'resolved') return <></>
		const maybeAddress = asyncAddress.value.value
		if (maybeAddress === undefined) return <></>
		const address = maybeAddress
		if (savedWindowWallets.value.includes(address)) {
			return <button onClick={() => forgetWindowWalletAddress(address)}>Forget</button>
		} else {
			return <button onClick={() => rememberWindowWalletAddress(address)}>Remember</button>
		}
	})

	const [Address_] = useState(() => () => {
		switch (asyncAddress.value.state) {
			case 'inactive': return <>Unexpected state, please report bug to developer.</>
			case 'pending': return <>Loading accounts... <Spinner/></>
			case 'resolved': return asyncAddress.value.value !== undefined ? <>Address:<code>{addressBigintToHex(asyncAddress.value.value)}</code></> : <>No accounts provided by browser wallet.</>
			case 'rejected': return <>Error while retrieving accounts from browser wallet: ${asyncAddress.value.error.message}</>
		}
	})
	return <div style={{ flexGrow: 1 }}>
		<div style={{ flexGrow: '1', alignItems: 'flex-start' }}>
			<Address_/><Refresh onClick={requestAccounts}/>
		</div>
		<RememberButton_/>
	</div>
}

function MemoryWalletBuilder(model: { wallet: OptionalSignal<Wallet>, error: OptionalSignal<string> }) {
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
	const [ChangeAccountButton_] = useState(() => () => <button onClick={() => { ethereumClientSignal.value = privateKeySignal.value = undefined }} style={{ marginLeft: 'auto' }}>Change Wallet</button>)
	if (ethereumClientSignal.value === undefined) {
		return <RpcChooser ethereumClient={ethereumClientSignal} error={model.error}/>
	} else if (privateKeySignal.value === undefined) {
		return <KeySelector privateKey={privateKeySignal}/>
	} else {
		return <div style={{ flexGrow: 1 }}>Address:<code>{addressBigintToHex(getAddress(privateKeySignal.value.value))}</code><ChangeAccountButton_/></div>
	}
}

function KeySelector({ privateKey }: { privateKey: OptionalSignal<bigint> }) {
	const seed = useOptionalSignal<Uint8Array>(undefined)
	if (privateKey.value !== undefined) {
		return <button onClick={() => privateKey.value = seed.value = undefined} style={{ marginLeft: 'auto' }}>Change Address</button>
	} else if (seed.value !== undefined) {
		return <DerivationPathPrompt seed={seed.value} privateKey={privateKey}/>
	} else {
		return <MnemonicOrKeyPrompt seed={seed} privateKey={privateKey}/>
	}
}

function MnemonicOrKeyPrompt({ seed, privateKey }: { seed: OptionalSignal<Uint8Array>, privateKey: OptionalSignal<bigint> }) {
	const [Prompt_] = useState(() => () => {
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
		const [ChangeButton_] = useState(() => () => <button onClick={reset} style={{ marginLeft: 'auto' }}>Change</button>)
		const [Input_] = useState(() => () => <AutosizingInput type='password' autocomplete='off' placeholder='zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong' value={internalValue}/>)
		const [NextButton_] = useState(() => () => <button onClick={onClick}>Next</button>)
		switch (value.value.state) {
			case 'inactive': return <><label>Mnemonic or Private Key<Input_/></label><NextButton_/></>
			case 'pending': return <>Validating {internalValue.value}...<Spinner/></>
			case 'rejected': return <><span style={{ color: 'red' }}>{value.value.error.message}</span><ChangeButton_/></>
			case 'resolved': return <>{internalValue.value} <ChangeButton_/></>
		}
	})
	return <div style={{ flexGrow: 1 }}><Prompt_/></div>
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
	return <div style={{ flexGrow: 1 }}>
		<label>
			Derivation Path&thinsp;
			<AutosizingInput type='text' pattern="^m(?:\/\d+'?)+$" placeholder="m/44'/60'/0'/0/0" value={derivationPath} dataList={[`m/44'/60'/0'/0/0`]}/>
		</label>
		&thinsp;
		<button onClick={onClick} style={{ marginLeft: 'auto' }}>Next</button>
	</div>
}
