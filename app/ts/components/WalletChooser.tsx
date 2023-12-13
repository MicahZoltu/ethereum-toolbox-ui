import { utils as secp256k1Utils } from '@noble/secp256k1'
import { ReadonlySignal, batch, useSignal, useSignalEffect } from '@preact/signals'
import { HDKey } from '@scure/bip32'
import { mnemonicToSeed, validateMnemonic } from '@zoltu/bip39'
import { wordlist } from '@zoltu/bip39/wordlists/english.js'
import { getAddress as getAddressFromLedger } from '@zoltu/ethereum-ledger'
import { getAddress as getAddressFromPrivateKey } from '@zoltu/ethereum-transactions'
import { addressBigintToHex, bigintToHex, bytesToBigint } from '@zoltu/ethereum-transactions/converters.js'
import { useState } from 'preact/hooks'
import { JSX } from 'preact/jsx-runtime'
import { forgetRecoverableWalletAddress, forgetSafeWalletAddress, forgetWalletAddress, forgetWindowWalletAddress, rememberLedgerWalletAddress, rememberRecoverableWalletAddress, rememberSafeWalletAddress, rememberWindowWalletAddress, savedRecoverableWallets, savedSafeWallets, savedWallets, savedWindowWallets } from '../library/addresses.js'
import { EthereumClientJsonRpc, EthereumClientLedger, EthereumClientMemory, EthereumClientRecoverable, EthereumClientSafe, EthereumClientWindow, Wallet } from '../library/ethereum.js'
import { OptionalSignal, useAsyncState, useOptionalSignal } from '../library/preact-utilities.js'
import { AddressPicker } from './AddressPicker.js'
import { AutosizingInput } from './AutosizingInput.js'
import { Refresh } from './Refresh.js'
import { RpcChooser } from './RpcChooser.js'
import { Select } from './Select.js'
import { Spinner } from './Spinner.js'

export interface WalletChooserModel {
	readonly wallet: OptionalSignal<Wallet>
	readonly noticeError: (error: unknown) => unknown
	readonly style?: JSX.CSSProperties
	readonly class?: JSX.HTMLAttributes['class']
}
export function WalletChooser(model: WalletChooserModel) {
	const walletType = useSignal<'readonly' | 'memory' | 'window' | 'recoverable' | 'safe' | 'ledger'>('readonly')
	useSignalEffect(() => walletType.value && model.wallet.clear())
	const [WalletBuilder_] = useState(() => () => {
		switch (walletType.value) {
			case 'readonly': return <ReadonlyWalletBuilder wallet={model.wallet} noticeError={model.noticeError}/>
			case 'memory': return <MemoryWalletBuilder wallet={model.wallet} noticeError={model.noticeError}/>
			case 'window': return <WindowWalletBuilder wallet={model.wallet} noticeError={model.noticeError}/>
			case 'recoverable': return <RecoverableWalletBuilder wallet={model.wallet} noticeError={model.noticeError}/>
			case 'safe': return <SafeWalletBuilder wallet={model.wallet} noticeError={model.noticeError}/>
			case 'ledger': return <LedgerWalletBuilder wallet={model.wallet} noticeError={model.noticeError}/>
		}
	})
	return <div style={model.style} class={model.class}>
		<div><Select options={['readonly', 'memory', 'window', 'recoverable', 'safe', 'ledger']} selected={walletType} /><WalletBuilder_/></div>
	</div>
}

function ReadonlyWalletBuilder(model: { wallet: OptionalSignal<Wallet>, noticeError: (error: unknown) => unknown }) {
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
		return <RpcChooser ethereumClient={maybeEthereumClient} noticeError={model.noticeError}/>
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

function RecoverableWalletBuilder(model: { wallet: OptionalSignal<Wallet>, noticeError: (error: unknown) => unknown }) {
	const underlyingWallet = useOptionalSignal<Wallet>(undefined)
	const maybeAddress = useOptionalSignal<bigint>(undefined)
	useSignalEffect(() => {
		if (underlyingWallet.deepValue === undefined || maybeAddress.deepValue === undefined) {
			model.wallet.deepValue = undefined
			return
		}
		const ethereumClient = new EthereumClientRecoverable(underlyingWallet.deepValue.ethereumClient, underlyingWallet.deepValue.address, maybeAddress.deepValue)
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
			? <AddressPicker required address={maybeAddress} extraOptions={savedRecoverableWallets}/>
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
				const ethereumClient = new EthereumClientRecoverable(underlyingWallet_.ethereumClient, underlyingWallet_.address, address_)
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
			<WalletChooser wallet={underlyingWallet} noticeError={model.noticeError}/>
		</div>
	})
	const [RememberButton_] = useState(()=> () => {
		const address = maybeAddress.deepValue
		if (address === undefined) return <></>
		if (savedRecoverableWallets.value.includes(address)) {
			return <button onClick={() => forgetRecoverableWalletAddress(address)} style={{ width: '100%' }}>Forget</button>
		} else {
			return <button onClick={() => rememberRecoverableWalletAddress(address)} style={{ width: '100%' }}>Remember</button>
		}
	})
	const [ContractWallet_] = useState(() => () => {
		return <div style={{ flexDirection: 'column', border: '1px dashed blue', padding: '3px' }}>
			<div>Recoverable Wallet:</div>
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

function SafeWalletBuilder(model: { wallet: OptionalSignal<Wallet>, noticeError: (error: unknown) => unknown }) {
	const underlyingWallet = useOptionalSignal<Wallet>(undefined)
	const maybeAddress = useOptionalSignal<bigint>(undefined)
	useSignalEffect(() => {
		if (underlyingWallet.deepValue === undefined || maybeAddress.deepValue === undefined) {
			model.wallet.deepValue = undefined
			return
		}
		const ethereumClient = new EthereumClientSafe(underlyingWallet.deepValue.ethereumClient, underlyingWallet.deepValue.address, maybeAddress.deepValue)
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
			? <AddressPicker required address={maybeAddress} extraOptions={savedSafeWallets}/>
			: <>Contract:<code>{addressBigintToHex(maybeAddress.deepValue)}</code></>
	})
	const [SignerWallet_] = useState(() => () => {
		return <div style={{ flexDirection: 'column', border: '1px dashed blue', padding: '3px' }}>
			<div>Signer:</div>
			<WalletChooser wallet={underlyingWallet} noticeError={model.noticeError}/>
		</div>
	})
	const [RememberButton_] = useState(()=> () => {
		const address = maybeAddress.deepValue
		if (address === undefined) return <></>
		if (savedSafeWallets.value.includes(address)) {
			return <button onClick={() => forgetSafeWalletAddress(address)} style={{ width: '100%' }}>Forget</button>
		} else {
			return <button onClick={() => rememberSafeWalletAddress(address)} style={{ width: '100%' }}>Remember</button>
		}
	})
	const [ContractWallet_] = useState(() => () => {
		return <div style={{ flexDirection: 'column', border: '1px dashed blue', padding: '3px' }}>
			<div>Gnosis SAFE Wallet:</div>
			<div>
				<div style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
					<div style={{ width: '100%' }}><ContractAddress_/></div>
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

function WindowWalletBuilder(model: { wallet: OptionalSignal<Wallet>, noticeError: (error: unknown) => unknown }) {
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
			model.wallet.deepValue = { readonly: false, ethereumClient, address }
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
			case 'rejected': return <>Error while retrieving accounts from browser wallet: {asyncAddress.value.error.message}</>
		}
	})
	return <div style={{ flexGrow: 1 }}>
		<div style={{ flexGrow: '1', alignItems: 'flex-start' }}>
			<Address_/><Refresh onClick={requestAccounts}/>
		</div>
		<RememberButton_/>
	</div>
}

function LedgerWalletBuilder(model: { wallet: OptionalSignal<Wallet>, noticeError: (error: unknown) => unknown }) {
	const maybeEthereumClientRpc = useOptionalSignal<EthereumClientJsonRpc>(undefined)
	const maybeDerivationPath = useOptionalSignal<`m/${string}`>(undefined)
	const { value: asyncWalletBuild, waitFor: waitForWalletBuild } = useAsyncState()
	useSignalEffect(() => batch(() => {
		if (asyncWalletBuild.value.state === 'rejected') {
			model.noticeError(asyncWalletBuild.value.error)
		}
		if (asyncWalletBuild.value.state === 'pending' || maybeEthereumClientRpc.deepValue === undefined || maybeDerivationPath.deepValue === undefined) {
			model.wallet.clear()
		}
	}))
	const [Address_] = useState(() => () => {
		const wallet = model.wallet.deepValue
		if (wallet === undefined) return <></>
		return <div>Address:<code>{addressBigintToHex(wallet.address)}</code></div>
	})
	const [ChangeButton_] = useState(() => () => <button onClick={() => { maybeEthereumClientRpc.clear() }} style={{width: '100%'}}>Change</button>)
	const [RememberButton_] = useState(() => () => {
		const wallet = model.wallet.deepValue
		if (wallet === undefined) return <></>
		if (savedWallets.value.includes(wallet.address)) {
			return <button onClick={() => forgetWalletAddress(wallet.address)} style={{width:'100%'}}>Forget</button>
		} else {
			return <button onClick={() => rememberLedgerWalletAddress(wallet.address)} style={{width:'100%'}}>Remember</button>
		}
	})
	const [DerivationPathPicker_] = useState(() => () => {
		function onClick() {
			waitForWalletBuild(async () => {
				const ethereumClientRpc = maybeEthereumClientRpc.deepValue
				const derivationPath = maybeDerivationPath.deepValue
				if (ethereumClientRpc === undefined) throw new Error(`JSON-RPC Ethereum Client required.`)
				if (derivationPath === undefined) throw new Error(`Derivation path required.`)
				const address = await getAddressFromLedger(derivationPath)
				const ethereumClient = new EthereumClientLedger(ethereumClientRpc, derivationPath, address)
				model.wallet.deepValue = { address, ethereumClient, readonly: false }
			})
		}
		return <div><DerivationPathPicker value={maybeDerivationPath}/><button onClick={onClick} disabled={maybeDerivationPath.deepValue === undefined}>Next</button></div>
	})
	if (maybeEthereumClientRpc.deepValue === undefined) {
		return <RpcChooser ethereumClient={maybeEthereumClientRpc} noticeError={model.noticeError}/>
	} else if (maybeDerivationPath.deepValue === undefined || asyncWalletBuild.value.state === 'inactive' || asyncWalletBuild.value.state === 'rejected') {
		return <DerivationPathPicker_/>
	} else if (asyncWalletBuild.value.state === 'pending') {
		return <Spinner/>
	} else {
		return <div id='ledger-builder' style={{ flexGrow: 1 }}>
			<div style={{ flexGrow: 1, flexDirection: 'column', alignItems: 'flex-start' }}>
				<Address_/>
			</div>
			<div style={{ flexDirection: 'column' }}>
				<ChangeButton_/>
				<RememberButton_/>
			</div>
		</div>
	}
}

function MemoryWalletBuilder(model: { wallet: OptionalSignal<Wallet>, noticeError: (error: unknown) => unknown }) {
	const maybeEthereumClientRpc = useOptionalSignal<EthereumClientJsonRpc>(undefined)
	const maybeEthereumClientMemory = useOptionalSignal<EthereumClientMemory>(undefined)
	const maybePrivateKey = useOptionalSignal<bigint>(undefined)
	useSignalEffect(() => {
		const ethereumClientRpc = maybeEthereumClientRpc.deepValue
		const privateKey = maybePrivateKey.deepValue
		if (ethereumClientRpc === undefined) {
			model.wallet.clear()
		} else if (privateKey === undefined) {
			model.wallet.clear()
		} else {
			const address = getAddressFromPrivateKey(privateKey)
			const ethereumClient = maybeEthereumClientMemory.deepValue = new EthereumClientMemory(ethereumClientRpc, privateKey, address)
			model.wallet.deepValue = ({ readonly: false, address, ethereumClient })
		}
	})
	const [ChangeAccountButton_] = useState(() => () => <button onClick={() => { maybeEthereumClientRpc.value = maybePrivateKey.value = undefined }} style={{ marginLeft: 'auto' }}>Change Wallet</button>)
	if (maybeEthereumClientRpc.value === undefined) {
		return <RpcChooser ethereumClient={maybeEthereumClientRpc} noticeError={model.noticeError}/>
	} else if (maybePrivateKey.value === undefined) {
		return <KeySelector privateKey={maybePrivateKey} noticeError={model.noticeError}/>
	} else {
		return <div style={{ flexGrow: 1 }}>Address:<code>{addressBigintToHex(getAddressFromPrivateKey(maybePrivateKey.value.value))}</code>Private Key:<code class='secret'>{bigintToHex(maybePrivateKey.value.value, 32)}</code><ChangeAccountButton_/></div>
	}
}

function KeySelector({ privateKey, noticeError }: { privateKey: OptionalSignal<bigint>, noticeError: (error: unknown) => unknown }) {
	const seed = useOptionalSignal<Uint8Array>(undefined)
	if (privateKey.value !== undefined) {
		return <button onClick={() => privateKey.value = seed.value = undefined} style={{ marginLeft: 'auto' }}>Change Address</button>
	} else if (seed.value !== undefined) {
		return <DerivationPathPrompt seed={seed.value} privateKey={privateKey}/>
	} else {
		return <MnemonicOrKeyPrompt seed={seed} privateKey={privateKey} noticeError={noticeError}/>
	}
}

function MnemonicOrKeyPrompt({ seed, privateKey, noticeError }: { seed: OptionalSignal<Uint8Array>, privateKey: OptionalSignal<bigint>, noticeError: (error: unknown) => unknown }) {
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
		useSignalEffect(() => { if (value.value.state === 'rejected') { noticeError(value.value.error); reset() } })
		const [ChangeButton_] = useState(() => () => <button onClick={reset} style={{ marginLeft: 'auto' }}>Change</button>)
		const [Input_] = useState(() => () => <AutosizingInput type='password' autocomplete='off' placeholder='zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong' value={internalValue}/>)
		const [NextButton_] = useState(() => () => <button onClick={onClick}>Next</button>)
		const [RandomButton_] = useState(() => () => <button onClick={() => privateKey.deepValue = bytesToBigint(secp256k1Utils.randomPrivateKey())}>Random</button>)
		switch (value.value.state) {
			case 'inactive': return <><label>Mnemonic or Private Key<Input_/></label><RandomButton_/><NextButton_/></>
			case 'pending': return <>Validating {internalValue.value}...<Spinner/></>
			case 'rejected': return <>Error: <ChangeButton_/></>
			case 'resolved': return <>{internalValue.value} <ChangeButton_/></>
		}
	})
	return <div style={{ flexGrow: 1 }}><Prompt_/></div>
}

function DerivationPathPrompt({ seed, privateKey}: { seed: ReadonlySignal<Uint8Array>, privateKey: OptionalSignal<bigint> }) {
	const maybeDerivationPath = useOptionalSignal<`m/${string}`>(undefined)
	function onClick() {
		const derivationPath = maybeDerivationPath.deepPeek()
		if (derivationPath === undefined) return
		const hdKey = HDKey.fromMasterSeed(seed.value)
		const derivedHdKey = hdKey.derive(derivationPath)
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
			<DerivationPathPicker value={maybeDerivationPath}/>
		</label>
		&thinsp;
		<button onClick={onClick} style={{ marginLeft: 'auto' }}>Next</button>
	</div>
}

function DerivationPathPicker({ value: maybeDerivationPath }: { value: OptionalSignal<`m/${string}`> }) {
	const sanitize = (input: string) => (input === '') ? '' : `m/${input.slice(2).replaceAll(/[^m\/\d']/g, '')}`
	const serialize = (input: `m/${string}` | undefined) => input === undefined ? '' : input
	const tryParse = (input: string) => ({ ok: true, value: /^m(?:\/\d+'?)+$/.test(input) ? input as `m/${string}` : undefined })
	return <AutosizingInput value={maybeDerivationPath} sanitize={sanitize} serialize={serialize} tryParse={tryParse} type='text' pattern="^m(?:\/\d+'?)+$" placeholder="m/44'/60'/0'/0/0" dataList={[`m/44'/60'/0'/0/0`]}/>
}
