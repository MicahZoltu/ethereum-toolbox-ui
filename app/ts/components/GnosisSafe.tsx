import { keccak_256 } from '@noble/hashes/sha3'
import { ReadonlySignal, Signal, useSignalEffect } from "@preact/signals"
import { addressBigintToHex, addressHexToBigint, bigintToBytes, bytesToBigint, hexToBytes } from "@zoltu/ethereum-transactions/converters.js"
import { contract } from "micro-web3"
import { useEffect, useState } from "preact/hooks"
import { JSX } from "preact/jsx-runtime"
import { savedSafeWallets } from '../library/addresses.js'
import { GNOSIS_SAFE_ABI, GNOSIS_SAFE_DELAY_MODULE_ABI, GNOSIS_SAFE_DELAY_MODULE_MASTER_ADDRESS, GNOSIS_SAFE_DELAY_MODULE_PROXY_FACTORY_ABI, GNOSIS_SAFE_DELAY_MODULE_PROXY_FACTORY_ADDRESS, MULTISEND_CALL_ABI, MULTISEND_CALL_ADDRESS } from "../library/contract-details.js"
import { IEthereumClient, Wallet } from "../library/ethereum.js"
import { OptionalSignal, useAsyncState, useOptionalSignal } from "../library/preact-utilities.js"
import { NarrowUnion, ResolvePromise } from "../library/typescript.js"
import { AddressPicker } from "./AddressPicker.js"
import { CloseButton } from "./CloseButton.js"
import { IntegerInput } from './IntegerInput.js'
import { Refresh } from "./Refresh.js"
import { Spacer } from './Spacer.js'
import { Spinner } from "./Spinner.js"

// this is relatively expensive to instantiate and it is pure so we can just reuse this one instance
const safeContract = contract(GNOSIS_SAFE_ABI)
const multisendContract = contract(MULTISEND_CALL_ABI)
const delayModuleContract = contract(GNOSIS_SAFE_DELAY_MODULE_ABI)
const delayModuleProxyFactoryContract = contract(GNOSIS_SAFE_DELAY_MODULE_PROXY_FACTORY_ABI)

export type GnosisSafeModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly noticeError: (error: unknown) => unknown
	readonly style?: JSX.CSSProperties
	readonly class?: JSX.HTMLAttributes['class']
}
export function GnosisSafe(model: GnosisSafeModel) {
	const maybeSafeAddress = useOptionalSignal<bigint>(undefined)
	const [SafeSelector_] = useState(() => () => {
		if (maybeSafeAddress.deepValue !== undefined) return <></>
		return <div style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
			<CreateSafe wallet={model.wallet} noticeError={model.noticeError} createdSafeAddress={maybeSafeAddress}/>
			<span>Manage Gnosis SAFE at<AddressPicker address={maybeSafeAddress} extraOptions={[model.wallet.value.address, ...savedSafeWallets.value]}/></span>
		</div>
	})
	const [SafeManager_] = useState(() => () => {
		if (maybeSafeAddress.deepValue === undefined) return <></>
		return <SafeManager wallet={model.wallet} noticeError={model.noticeError} maybeSafeAddress={maybeSafeAddress}/>
	})

	return <div id='GnosisSafe' style={model.style} class={model.class}>
		<h1>Gnosis SAFE</h1>
		<SafeSelector_/>
		<SafeManager_/>
	</div>
}

export type CreateSafeModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly createdSafeAddress: OptionalSignal<bigint>
	readonly noticeError: (error: unknown) => unknown
}
export function CreateSafe(model: CreateSafeModel) {
	const { value, waitFor } = useAsyncState<bigint>()
	useSignalEffect(() => {if (value.value.state === 'resolved') model.createdSafeAddress.deepValue = value.value.value })
	function createSafe() {
		waitFor(async () => {
			// TODO
			return 0n
		})
	}
	return <span>Create a new Gnosis SAFE: <button onClick={createSafe}>Create</button></span>
}

export type SafeManagerModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly maybeSafeAddress: OptionalSignal<bigint>
	readonly noticeError: (error: unknown) => unknown
}
export function SafeManager(model: SafeManagerModel) {
	const maybeSafeClient = useOptionalSignal<SafeClient>(undefined)

	useSignalEffect(() => {
		const safeAddress = model.maybeSafeAddress.deepValue
		maybeSafeClient.clear()
		if (safeAddress === undefined) return
		SafeClient.create(model.wallet.value.ethereumClient, safeAddress)
			.then(safeClient => maybeSafeClient.deepValue = safeClient)
			.catch(error => { model.noticeError(error); model.maybeSafeAddress.clear() })
	})

	const [ChangeSafeButton_] = useState(() => () => <button onClick={() => model.maybeSafeAddress.clear()}>Change</button>)

	if (model.maybeSafeAddress.deepValue === undefined) {
		return <></>
	} else if (maybeSafeClient.value === undefined || maybeSafeClient.deepValue === undefined) {
		return <Spinner/>
	} else {
		const [SafeRecovery_] = useState(() => (_: { safeClient: Signal<SafeClient> }) => {
			return <></>
		})
		return <>
			<span><span>Safe Address: <code>{addressBigintToHex(model.maybeSafeAddress.deepValue)}</code></span><Spacer/><ChangeSafeButton_/></span>
			<SafeRecovery_ safeClient={maybeSafeClient.value}/>
			<RecovererList ethereumClient={model.wallet.value.ethereumClient} safeClient={maybeSafeClient.value} noticeError={model.noticeError}/>
			<Signers safeClient={maybeSafeClient.value} noticeError={model.noticeError}/>
		</>
	}
}

function RecovererList(model: {
	readonly ethereumClient: IEthereumClient
	readonly safeClient: ReadonlySignal<SafeClient>
	readonly noticeError: (error: unknown) => unknown
}) {
	const { value: recoverersAsync, waitFor: waitForRecoverers } = useAsyncState<DelayModuleClient[]>({ onRejected: model.noticeError })

	function refresh() {
		const safeClient = model.safeClient.value
		waitForRecoverers(async () => {
			const moduleAddresses = await safeClient.getModules()
			const delayModules = (await Promise.all(moduleAddresses.map(moduleAddress => tryGetDelayModuleClients(model.ethereumClient, moduleAddress, safeClient.address)))).flat()
			return delayModules.sort((a, b) => Number(a.cooldown) - Number(b.cooldown))
		})
	}
	useEffect(refresh, [])

	const [Recoverers_] = useState(() => () => {
		const [Recoverer_] = useState(() => ({recoverer}: {recoverer: DelayModuleClient}) => {
			const [Address_] = useState(() => () => <code>{addressBigintToHex(recoverer.recovererAddress)}</code>)
			const [RemoveRecovererButton_] = useState(() => () => <RemoveRecovererButton safeClient={model.safeClient} noticeError={model.noticeError} delayModuleAddress={recoverer.moduleAddress} refreshRecoverers={refresh}/>)
			return <span><span>{Number(recoverer.cooldown * 100n / 60n / 60n / 24n) / 100} Days - <Address_/></span><RemoveRecovererButton_ /></span>
		})
		const [AddRecoverer_] = useState(() => () => {
			const safeClient = model.safeClient.value
			if (!(safeClient instanceof OwnedSafeClient)) return <></>
			const maybeAddress = useOptionalSignal<bigint>(undefined)
			const maybeDelayDays = useOptionalSignal<bigint>(undefined)
			const { value, waitFor } = useAsyncState<void>({ onRejected: model.noticeError, onResolved: refresh })
			const addRecoverer = () => {
				const address = maybeAddress.deepValue
				const delayDays = maybeDelayDays.deepValue
				if (address === undefined) return model.noticeError(`Missing recoverer address.`)
				if (delayDays === undefined) return model.noticeError(`Missing recovery delay.`)
				waitFor(async () => { await createAndInitializeRecoverer(safeClient, address, delayDays * 24n * 60n * 60n) })
			}
			switch (value.value.state) {
				case 'pending': return <Spinner/>
				case 'resolved':
				case 'inactive': 
				case 'rejected': return <span>
					<IntegerInput value={maybeDelayDays} autoSize required placeholder='Days' dataList={['2','7','14','28','56']}/>
					<AddressPicker address={maybeAddress} required/>
					<Spacer/>
					<button onClick={addRecoverer}>Add</button>
				</span>
			}
		})
		switch (recoverersAsync.value.state) {
			case 'inactive':
			case 'rejected': return <></>
			case 'pending': return <Spinner/>
			case 'resolved': return <div style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
				{ recoverersAsync.value.value.map(recoverer => <Recoverer_ recoverer={recoverer}/>) }
				<AddRecoverer_/>
			</div>
		}
	})

	return <div class='subwidget'>
		<span><h1>Recoverers</h1><Refresh onClick={refresh}/></span>
		<Recoverers_/>
	</div>
}

function Signers(model: {
	readonly safeClient: ReadonlySignal<SafeClient>
	readonly noticeError: (error: unknown) => unknown
}) {
	const { value, waitFor } = useAsyncState<{ owners: bigint[], threshold: bigint }>()
	function refresh() {
		waitFor(async () => {
			const threshold = model.safeClient.value.getThreshold()
			const owners = model.safeClient.value.getOwners()
			return { threshold: await threshold, owners: await owners }
		})
	}
	useSignalEffect(() => { value.value.state === 'rejected' && model.noticeError(value.value.error) })
	useEffect(refresh, [])
	// CONSIDER: split threshold and owner list into two independently refreshable components
	const [ThresholdText_] = useState(() => ({ threshold, owners }: { threshold: bigint, owners: bigint[] }) => {
		const fontSize = owners.length === 1 ? undefined : 'xxx-large'
		return <div style={{ paddingRight: '0.5em' }}><span style={{ fontSize, lineHeight: '0.75' }}>{threshold}</span><span>of</span></div>
	})
	const [Inner_] = useState(() => () => {
		switch (value.value.state) {
			case 'inactive':
			case 'rejected': return <></>
			case 'pending': return <Spinner/>
			case 'resolved': return <div>
				<ThresholdText_ threshold={value.value.value.threshold} owners={value.value.value.owners}/>
				<SignerList safeClient={model.safeClient} noticeError={model.noticeError} owners={value.value.value.owners} refreshSigners={refresh}/>
			</div>
		}
	})
	return <div class='subwidget'>
		<span><h1>Signers</h1><Refresh onClick={refresh}/></span>
		<Inner_/>
	</div>
}

function SignerList(model: {
	readonly safeClient: ReadonlySignal<SafeClient>
	readonly owners: bigint[]
	readonly refreshSigners: () => unknown
	readonly noticeError: (error: unknown) => unknown
}) {
	const [Signer_] = useState(() => ({ owner }: { owner: bigint }) => {
		const [Address_] = useState(() => () => <code>{addressBigintToHex(owner)}</code>)
		const [RemoveButton_] = useState(() => () => <RemoveOwnerButton safeClient={model.safeClient} noticeError={model.noticeError} refreshSigners={model.refreshSigners} ownerToRemove={owner}/>)
		return <span><Address_/><RemoveButton_/></span>
	})
	return <div style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
		{ model.owners.map(owner => <Signer_ owner={owner}/>)}
	</div>
}

function RemoveOwnerButton(model: {
	readonly safeClient: ReadonlySignal<SafeClient>
	readonly ownerToRemove: bigint
	readonly refreshSigners: () => unknown
	readonly noticeError: (error: unknown) => unknown
}) {
	const safeClient = model.safeClient.value
	if (!(safeClient instanceof OwnedSafeClient)) return <></>
	const { value, waitFor } = useAsyncState<void>({ onRejected: model.noticeError, onResolved: model.refreshSigners })
	const remove = () => waitFor(async () => { await safeClient.removeOwner(model.ownerToRemove) })
	switch (value.value.state) {
		case 'inactive':
		case 'rejected': return <CloseButton onClick={remove}/>
		case 'pending': return <Spinner/>
		case 'resolved': return <></>
	}
}

function RemoveRecovererButton(model: {
	readonly safeClient: ReadonlySignal<SafeClient>
	readonly delayModuleAddress: bigint
	readonly refreshRecoverers: () => unknown
	readonly noticeError: (error: unknown) => unknown
}) {
	const safeClient = model.safeClient.value
	if (!(safeClient instanceof OwnedSafeClient)) return <></>
	const { value, waitFor } = useAsyncState<void>({ onRejected: model.noticeError, onResolved: model.refreshRecoverers })
	const remove = () => waitFor(async () => { await safeClient.removeModule(model.delayModuleAddress) })
	switch (value.value.state) {
		case 'inactive':
		case 'rejected': return <CloseButton onClick={remove}/>
		case 'pending': return <Spinner/>
		case 'resolved': return <></>
	}
}

async function tryGetDelayModuleClients(ethereumClient: IEthereumClient, delayModuleAddress: bigint, safeAddress: bigint) {
	//
	// Read Functions
	//
	async function getModules() {
		const modules: bigint[] = []
		// modules are stored as a linked list with the first item being at mapping(1)
		let nextModule = 1n
		const pageSize = 100n
		do {
			const result = await ethereumClient.call({
				to: delayModuleAddress,
				value: 0n,
				data: safeContract.getModulesPaginated.encodeInput({ start: addressBigintToHex(nextModule), pageSize })
			}, 'latest')
			const { array, next } = safeContract.getModulesPaginated.decodeOutput(result)
			modules.push(...array.map(addressHexToBigint))
			nextModule = addressHexToBigint(next)
		// reached end of list when the next module is 0 or 1
		} while (nextModule !== 0n && nextModule !== 1n)
		return modules
	}
	async function getSafe() {
		const result = await ethereumClient.call({
			to: delayModuleAddress,
			data: delayModuleContract.avatar.encodeInput({}),
		}, 'latest')
		return addressHexToBigint(delayModuleContract.avatar.decodeOutput(result))
	}
	async function getOwner() {
		const result = await ethereumClient.call({
			to: delayModuleAddress,
			data: delayModuleContract.owner.encodeInput({}),
		}, 'latest')
		return addressHexToBigint(delayModuleContract.owner.decodeOutput(result))
	}
	async function getNonce() {
		const result = await ethereumClient.call({
			to: delayModuleAddress,
			data: delayModuleContract.txNonce.encodeInput({}),
		}, 'latest')
		return delayModuleContract.txNonce.decodeOutput(result)
	}
	async function getQueuedNonce() {
		const result = await ethereumClient.call({
			to: delayModuleAddress,
			data: delayModuleContract.queueNonce.encodeInput({}),
		}, 'latest')
		return delayModuleContract.queueNonce.decodeOutput(result)
	}
	async function getCooldown() {
		const result = await ethereumClient.call({
			to: delayModuleAddress,
			data: delayModuleContract.txCooldown.encodeInput({}),
		}, 'latest')
		return delayModuleContract.txCooldown.decodeOutput(result)
	}
	async function hasQueuedTransaction() {
		const txNonce = getNonce()
		const queueNonce = getQueuedNonce()
		return await queueNonce > await txNonce
	}
	async function getRemainingCooldown() {
		const cooldownPromise = getCooldown()
		const result = await ethereumClient.call({
			to: delayModuleAddress,
			data: delayModuleContract.getTxCreatedAt.encodeInput(await getNonce())
		}, 'latest')
		const cooldown = await cooldownPromise
		const queuedAt = delayModuleContract.getTxCreatedAt.decodeOutput(result)
		const now = BigInt(Math.round(Date.now() / 1000))
		const remaining = (queuedAt + cooldown) - now
		return remaining > 0n ? remaining : 0n
	}

	//
	// Write Functions
	//
	async function queueRecovery() {
		const result = await ethereumClient.sendTransaction({
			to: delayModuleAddress,
			data: delayModuleContract.execTransactionFromModule.encodeInput({
				operation: 0n, // CALL
				to: addressBigintToHex(await getSafe()),
				value: 0n,
				data: safeContract.addOwnerWithThreshold.encodeInput({ owner: addressBigintToHex(await getOwner()), _threshold: 1n }),
			})
		})
		await result.waitForReceipt()
	}
	async function executeRecoverey() {
		const result = await ethereumClient.sendTransaction({
			to: delayModuleAddress,
			data: delayModuleContract.executeNextTx.encodeInput({
				operation: 0n, // CALL
				to: addressBigintToHex(await getSafe()),
				value: 0n,
				data: safeContract.addOwnerWithThreshold.encodeInput({ owner: addressBigintToHex(await getOwner()), _threshold: 1n }),
			})
		})
		await result.waitForReceipt()
	}

	try {
		const getSafePromise = getSafe()
		const getCooldownPromise = getCooldown()
		const getModulesPromise = getModules()
		const cooldown = await getCooldownPromise
		const modules = await getModulesPromise
		if (safeAddress !== await getSafePromise) throw new Error(`This module points at a different safe.`)
		// TODO: check additional stuff to verify this is a Delay Module and not something else
		return modules.map(recovererAddress => {
			const client = { owned: false, moduleAddress: delayModuleAddress, recovererAddress, safeAddress, cooldown, hasQueuedTransaction, getRemainingCooldown } as const
			if (ethereumClient.address !== recovererAddress) return client
			else return { ...client, owned: true, queueRecovery, executeRecoverey } as const
		})
	} catch {
		return []
	}
}
type OwnedDelayModuleClient = NarrowUnion<ResolvePromise<ReturnType<typeof tryGetDelayModuleClients>>[number], { owned: true }>
type UnownedDelayModuleClient = NarrowUnion<ResolvePromise<ReturnType<typeof tryGetDelayModuleClients>>[number], { owned: false }>
type DelayModuleClient = OwnedDelayModuleClient | UnownedDelayModuleClient

async function createAndInitializeRecoverer(safeClient: OwnedSafeClient, recoveryAddress: bigint, cooldown: bigint) {
	function calculateDelayModuleProxyAddress(initializer: Uint8Array, saltNonce: bigint) {
		const initCode = Uint8Array.from([...hexToBytes('0x602d8060093d393df3363d3d373d3d3d363d73'), ...bigintToBytes(GNOSIS_SAFE_DELAY_MODULE_MASTER_ADDRESS, 20), ...hexToBytes('0x5af43d82803e903d91602b57fd5bf3')])
		const initCodeHash = keccak_256(initCode)
		const deployerAddressBytes = bigintToBytes(GNOSIS_SAFE_DELAY_MODULE_PROXY_FACTORY_ADDRESS, 20)
		const saltBytes = keccak_256(Uint8Array.from([...keccak_256(initializer), ...bigintToBytes(saltNonce, 32)]))
		const delayModuleProxyAddress = bytesToBigint(keccak_256(Uint8Array.from([0xff, ...deployerAddressBytes, ...saltBytes, ...initCodeHash])).slice(12))
		return delayModuleProxyAddress
	}
	
	// create transaction to deploy the delay module proxy
	const ownerBytes = bigintToBytes(safeClient.address, 32)
	const avatarBytes = bigintToBytes(safeClient.address, 32)
	const targetBytes = bigintToBytes(safeClient.address, 32)
	const cooldownBytes = bigintToBytes(cooldown, 32)
	const expirationBytes = new Uint8Array(32)
	const delayModuleProxyDeployInitializer = delayModuleContract.setUp.encodeInput(Uint8Array.from([...ownerBytes, ...avatarBytes, ...targetBytes, ...cooldownBytes, ...expirationBytes]))
	const saltNonce = BigInt(Date.now())
	const delayModuleProxyDeployData = delayModuleProxyFactoryContract.deployModule.encodeInput({ masterCopy: addressBigintToHex(GNOSIS_SAFE_DELAY_MODULE_MASTER_ADDRESS), initializer: delayModuleProxyDeployInitializer, saltNonce })
	const delayModuleProxyAddress = calculateDelayModuleProxyAddress(delayModuleProxyDeployInitializer, saltNonce)

	await safeClient.multisend([
		{ to: GNOSIS_SAFE_DELAY_MODULE_PROXY_FACTORY_ADDRESS, value: 0n, data: delayModuleProxyDeployData },
		{ to: safeClient.address, value: 0n, data: safeContract.enableModule.encodeInput(addressBigintToHex(delayModuleProxyAddress)) },
		{ to: delayModuleProxyAddress, value: 0n, data: delayModuleContract.enableModule.encodeInput(addressBigintToHex(recoveryAddress)) },
	])

	return delayModuleProxyAddress
}

class SafeClient {
	public static async create(ethereumClient: IEthereumClient, address: bigint): Promise<SafeClient | OwnedSafeClient> {
		const error = new Error(`${addressBigintToHex(address)} does not appear to be a valid Gnosis SAFE.`)
		try {
			const tempSafeClient = new SafeClient(ethereumClient, address)
			const ownersPromise = tempSafeClient.getOwners()
			const thresholdPromise = tempSafeClient.getThreshold()
			const modulesPromise = tempSafeClient.getModules()
			const owners = await ownersPromise
			const threshold = await thresholdPromise
			await modulesPromise
			// TODO: check other functions that we care about
			if (owners.length === 0 || threshold === 0n) throw error
			if (ethereumClient.address === address && threshold === 1n) return new OwnedSafeClient(ethereumClient, address)
			return tempSafeClient
		} catch {
			throw error
		}
	}

	protected constructor(
		protected readonly ethereumClient: IEthereumClient,
		public readonly address: bigint,
	) { }

	public readonly isOwner = async (address: bigint) => {
		const result = await this.ethereumClient.call({
			to: this.address,
			data: safeContract.isOwner.encodeInput(addressBigintToHex(address))
		}, 'latest')
		return safeContract.isOwner.decodeOutput(result)
	}
	
	public readonly getOwners = async () => {
		const result = await this.ethereumClient.call({
			to: this.address,
			data: safeContract.getOwners.encodeInput({}),
		}, 'latest')
		return safeContract.getOwners.decodeOutput(result).map(addressHexToBigint)
	}

	public readonly getThreshold = async () => {
		const result = await this.ethereumClient.call({
			to: this.address,
			data: safeContract.getThreshold.encodeInput({}),
		}, 'latest')
		return safeContract.getThreshold.decodeOutput(result)
	}
	
	public readonly getModules = async () => {
		const modules: bigint[] = []
		// modules are stored as a linked list with the first item being at mapping(1)
		let nextModule = 1n
		const pageSize = 100n
		do {
			const result = await this.ethereumClient.call({
				to: this.address,
				value: 0n,
				data: safeContract.getModulesPaginated.encodeInput({ start: addressBigintToHex(nextModule), pageSize })
			}, 'latest')
			const { array, next } = safeContract.getModulesPaginated.decodeOutput(result)
			modules.push(...array.map(addressHexToBigint))
			nextModule = addressHexToBigint(next)
		// reached end of list when the next module is 0 or 1
		} while (nextModule !== 0n && nextModule !== 1n)
		return modules
	}
	
	public readonly isModuleEnabled = async (moduleAddress: bigint) => {
		const result = await this.ethereumClient.call({
			to: this.address,
			value: 0n,
			data: safeContract.isModuleEnabled.encodeInput(addressBigintToHex(moduleAddress))
		}, 'latest')
		return safeContract.isModuleEnabled.decodeOutput(result)
	}
}

class OwnedSafeClient extends SafeClient {
	public readonly addModule = async (moduleAddress: bigint) => {
		const result = await this.ethereumClient.sendTransaction({
			to: this.address,
			value: 0n,
			data: safeContract.enableModule.encodeInput(addressBigintToHex(moduleAddress)),
		})
		return await result.waitForReceipt()
	}
	
	public readonly removeModule = async (moduleAddress: bigint) => {
		// find the module we want to remove in the on-chain linked list of enabled modules
		const modules = await this.getModules()
		const moduleIndex = modules.findIndex(x => x === moduleAddress)
		if (moduleIndex === -1) throw new Error(`Module with address ${addressBigintToHex(moduleAddress)} is not a module for this SAFE.`)
		// non-null assertion is here because we are certain that moduleIndex is a valid index in this array, and that the array is not sparse, and in the case where it is 0 we return a hard coded value
		const prevModule = moduleIndex === 0 ? 1n : modules[moduleIndex - 1]!
	
		// remove the module
		const result = await this.ethereumClient.sendTransaction({
			to: this.address,
			value: 0n,
			data: safeContract.disableModule.encodeInput({ prevModule: addressBigintToHex(prevModule), module: addressBigintToHex(moduleAddress) }),
		})
		return await result.waitForReceipt()
	}

	public readonly addOwner = async (ownerAddress: bigint) => {
		const result = await this.ethereumClient.sendTransaction({
			to: this.address,
			data: safeContract.addOwnerWithThreshold.encodeInput({ owner: addressBigintToHex(ownerAddress), _threshold: 1n })
		})
		return await result.waitForReceipt()
	}

	public readonly removeOwner = async (ownerAddress: bigint) => {
		// find the owner in linked list
		const owners = await this.getOwners()
		const ownerIndex = owners.findIndex(item => item === ownerAddress)
		const previousOwner = ownerIndex === 0 ? 1n : owners[ownerIndex - 1]!

		// remove the owner
		const result = await this.ethereumClient.sendTransaction({
			to: this.address,
			data: safeContract.removeOwner.encodeInput({ prevOwner: addressBigintToHex(previousOwner), owner: addressBigintToHex(ownerAddress), _threshold: 1n }),
		})
		return await result.waitForReceipt()
	}

	public readonly multisend = async (transactions: readonly { readonly to: bigint, readonly value: bigint, readonly data: Uint8Array }[]) => {
		const transactionsBytes = Uint8Array.from([...transactions.flatMap(transaction => [0x00, ...bigintToBytes(transaction.to, 20), ...bigintToBytes(transaction.value, 32), ...bigintToBytes(BigInt(transaction.data.length), 32), ...transaction.data])])
		const transaction = {
			to: MULTISEND_CALL_ADDRESS,
			operation: 'DELEGATECALL', // operation isn't part of sendTransaction parameters according to TypeScript; it is a hidden optional parameter only by SAFE wallets
			data: multisendContract.multiSend.encodeInput(transactionsBytes),
		}
		const result = await this.ethereumClient.sendTransaction(transaction)
		return await result.waitForReceipt()
	}
}