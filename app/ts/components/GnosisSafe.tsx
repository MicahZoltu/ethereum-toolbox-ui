import { ReadonlySignal, Signal, useSignalEffect } from "@preact/signals"
import { addressBigintToHex, addressHexToBigint } from "@zoltu/ethereum-transactions/converters.js"
import { contract } from "micro-web3"
import { useEffect, useState } from "preact/hooks"
import { JSX } from "preact/jsx-runtime"
import { GNOSIS_SAFE_MASTER_ABI } from "../library/contract-details.js"
import { IEthereumClient, Wallet, toMicroWeb3 } from "../library/ethereum.js"
import { OptionalSignal, useAsyncState, useOptionalSignal } from "../library/preact-utilities.js"
import { AddressPicker } from "./AddressPicker.js"
import { Spinner } from "./Spinner.js"
import { Refresh } from "./Refresh.js"

export type GnosisSafeModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly noticeError: (error: unknown) => unknown
	readonly style?: JSX.CSSProperties
	readonly class?: JSX.HTMLAttributes['class']
}

export function GnosisSafe(model: GnosisSafeModel) {
	const maybeSafeAddress = useOptionalSignal<bigint>(undefined)

	return <div id='GnosisSafe' style={model.style} class={model.class}>
		<CreateSafe wallet={model.wallet} noticeError={model.noticeError} createdSafeAddress={maybeSafeAddress}/>
		<SafeManager wallet={model.wallet} noticeError={model.noticeError} maybeSafeAddress={maybeSafeAddress}/>
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
	const maybeSafeContract = useOptionalSignal<SafeContract>(undefined)

	useSignalEffect(() => {
		const safeAddress = model.maybeSafeAddress.deepValue
		maybeSafeContract.clear()
		if (safeAddress === undefined) return
		SafeContract.create(model.wallet.value.ethereumClient, safeAddress)
			.then(safeContract => maybeSafeContract.deepValue = safeContract)
			.catch(error => { model.noticeError(error); model.maybeSafeAddress.clear() })
	})

	const [SafeSelector_] = useState(() => () => <div>Manage Gnosis SAFE at <AddressPicker address={model.maybeSafeAddress} extraOptions={[model.wallet.value.address]}/></div>)
	const [ChangeSafeButton_] = useState(() => () => <button onClick={() => model.maybeSafeAddress.clear()}>Change</button>)

	if (model.maybeSafeAddress.deepValue === undefined) {
		return <SafeSelector_/>
	} else if (maybeSafeContract.value === undefined || maybeSafeContract.deepValue === undefined) {
		return <Spinner/>
	} else {
		const [SafeRecovery_] = useState(() => (_: { safeContract: Signal<SafeContract> }) => {
			return <></>
		})
		const [SafeRecoverers_] = useState(() => (_: { safeContract: Signal<SafeContract> }) => {
			return <></>
		})
		const [SafeSigners_] = useState(() => ({ safeContract }: { safeContract: Signal<SafeContract> }) => {
			const maybeThreshold = useOptionalSignal<bigint>(undefined)
			const maybeOwners = useOptionalSignal<bigint[]>(undefined)
			function refresh() {
				maybeThreshold.clear()
				maybeOwners.clear()
				safeContract.value.getThreshold()
					.then(threshold => maybeThreshold.deepValue = threshold)
					.catch(model.noticeError)
				safeContract.value.getOwners()
					.then(owners => maybeOwners.deepValue = owners)
					.catch(model.noticeError)
			}
			// TODO: only call refresh on first render
			useEffect(refresh, [])
			const [ThresholdText_] = useState(() => ({ threshold, owners }: { threshold: ReadonlySignal<bigint>, owners: ReadonlySignal<bigint[]> }) => {
				const fontSize = owners.value.length === 1 ? undefined : 'xxx-large'
				return <div style={{ paddingRight: '0.5em' }}><span style={{ fontSize, lineHeight: '0.75' }}>{threshold}</span><span>of</span></div>
			})
			const [OwnersList_] = useState(() => ({ owners }: { owners: ReadonlySignal<bigint[]> }) => <div style={{ flexDirection: 'column' }}>{ owners.value.map(owner => <code>{addressBigintToHex(owner)}</code>)}</div>)
			if (maybeThreshold.value === undefined || maybeOwners.value === undefined) return <Spinner/>
			else return <div><ThresholdText_ threshold={maybeThreshold.value} owners={maybeOwners.value}/><OwnersList_ owners={maybeOwners.value}/><Refresh onClick={refresh}/></div>
		})
		return <>
			<div>Safe Address: <code>{addressBigintToHex(model.maybeSafeAddress.deepValue)}</code><ChangeSafeButton_/></div>
			<SafeRecovery_ safeContract={maybeSafeContract.value}/>
			<SafeRecoverers_ safeContract={maybeSafeContract.value}/>
			<SafeSigners_ safeContract={maybeSafeContract.value}/>
		</>
	}
}

class SafeContract {
	public static async create(ethereumClient: IEthereumClient, address: bigint) {
		const error = new Error(`${addressBigintToHex(address)} does not appear to be a valid Gnosis SAFE.`)
		try {
			const safeContract = new SafeContract(ethereumClient, address)
			const results = await Promise.all([
				(async () => (await safeContract.getOwners()).length > 0)(),
				(async () => await safeContract.getThreshold() > 0n)(),
				(async () => !!await safeContract.getModules())(),
				// TODO: check other functions that we care about
			])
			if (!results.every(x => x)) throw error
			return safeContract
		} catch {
			throw error
		}
	}

	private constructor(
		private readonly ethereumClient: IEthereumClient,
		private readonly address: bigint
	) { }
	private readonly safeContract = contract(GNOSIS_SAFE_MASTER_ABI, toMicroWeb3(this.ethereumClient))

	public readonly isOwner = async (address: bigint) => {
		const result = await this.ethereumClient.call({
			to: this.address,
			data: this.safeContract.isOwner.encodeInput(addressBigintToHex(address))
		}, 'latest')
		return this.safeContract.isOwner.decodeOutput(result)
	}
	
	public readonly getOwners = async () => {
		const result = await this.ethereumClient.call({
			to: this.address,
			data: this.safeContract.getOwners.encodeInput({}),
		}, 'latest')
		return this.safeContract.getOwners.decodeOutput(result).map(addressHexToBigint)
	}
	
	public readonly getThreshold = async () => {
		const result = await this.ethereumClient.call({
			to: this.address,
			data: this.safeContract.getThreshold.encodeInput({}),
		}, 'latest')
		return this.safeContract.getThreshold.decodeOutput(result)
	}
	
	public readonly addModule = async (moduleAddress: bigint) => {
		const transaction = {
			to: this.address,
			value: 0n,
			data: this.safeContract.enableModule.encodeInput(addressBigintToHex(moduleAddress)),
		} as const
		const gas = await this.ethereumClient.estimateGas(transaction, 'latest')
		const result = await this.ethereumClient.sendTransaction({ ...transaction, gas })
		return result
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
				data: this.safeContract.getModulesPaginated.encodeInput({ start: addressBigintToHex(nextModule), pageSize })
			}, 'latest')
			const { array, next } = this.safeContract.getModulesPaginated.decodeOutput(result)
			modules.concat(array.map(addressHexToBigint))
			nextModule = addressHexToBigint(next)
		// reached end of list when the next module is 0 or 1
		} while (nextModule !== 0n && nextModule !== 1n)
		return modules
	}
	
	public readonly removeModule = async (moduleAddress: bigint) => {
		// find the module we want to remove in the on-chain linked list of enabled modules
		const modules = await this.getModules()
		const moduleIndex = modules.findIndex(x => x === moduleAddress)
		if (moduleIndex === -1) throw new Error(`Module with address ${moduleAddress} is not a module for this SAFE.`)
		// non-null assertion is here because we are certain that moduleIndex is a valid index in this array, and that the array is not sparse, and in the case where it is 0 we return a hard coded value
		const prevModule = moduleIndex === 0 ? -1n : modules[moduleIndex - 1]!
	
		// remove the module
		const transaction = {
			to: this.address,
			value: 0n,
			data: this.safeContract.disableModule.encodeInput({ prevModule: addressBigintToHex(prevModule), module: addressBigintToHex(moduleAddress) }),
		} as const
		const gas = await this.ethereumClient.estimateGas(transaction, 'latest')
		const result = await this.ethereumClient.sendTransaction({ ...transaction, gas })
		return result
	}
	
	public readonly isModuleEnabled = async (moduleAddress: bigint) => {
		const result = await this.ethereumClient.call({
			to: this.address,
			value: 0n,
			data: this.safeContract.isModuleEnabled.encodeInput(addressBigintToHex(moduleAddress))
		}, 'latest')
		return this.safeContract.isModuleEnabled.decodeOutput(result)
	}
}
