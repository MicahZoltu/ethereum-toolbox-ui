import { ReadonlySignal, useSignal } from "@preact/signals"
import { addressBigintToHex } from "@zoltu/ethereum-transactions/converters.js"
import { useState } from "preact/hooks"
import { JSX } from "preact/jsx-runtime"
import { savedSafeWallets, savedWallets } from '../library/addresses.js'
import { IEthereumClient, Wallet } from "../library/ethereum.js"
import { DelayModuleClient, SafeClient, createAndInitializeRecoverer, createAndInitializeSafe, getSafeClient, tryGetDelayModuleClients } from "../library/gnosis-safe.js"
import { useAsyncComputed, useAsyncRefreshable, useAsyncState, useOptionalSignal } from "../library/preact-utilities.js"
import { AddressPicker } from "./AddressPicker.js"
import { CloseButton } from "./CloseButton.js"
import { Countdown } from './Countdown.js'
import { IntegerInput } from './IntegerInput.js'
import { Refresh } from "./Refresh.js"
import { Spacer } from './Spacer.js'
import { Spinner } from "./Spinner.js"

export function GnosisSafe(model: {
	readonly wallet: ReadonlySignal<Wallet>
	readonly noticeError: (error: unknown) => unknown
	readonly style?: JSX.CSSProperties
	readonly class?: JSX.HTMLAttributes['class']
}) {
	const maybeSafeAddress = useOptionalSignal<bigint>(undefined)
	const [SafeSelector_] = useState(() => () => <div style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
		<CreateSafe wallet={model.wallet} safeCreated={maybeSafeAddress.set} noticeError={model.noticeError}/>
		<span>Manage Gnosis SAFE at<AddressPicker address={maybeSafeAddress} extraOptions={[model.wallet.value.address, ...savedSafeWallets.value]}/></span>
	</div>)
	const [SafeManager_] = useState(() => ({safeAddress}: {safeAddress: ReadonlySignal<bigint>}) => {
		const [SafeAddress_] = useState(() => () => <span>Safe Address: <code>{addressBigintToHex(safeAddress.value)}</code></span>)
		const [ChangeSafeButton_] = useState(() => () => <button onClick={() => maybeSafeAddress.clear()}>Change</button>)
		return <>
			<span><SafeAddress_/><Spacer/><ChangeSafeButton_/></span>
			<SafeManager wallet={model.wallet} safeAddress={safeAddress} noticeError={model.noticeError}/>
		</>
	})

	return <div id='GnosisSafe' style={model.style} class={model.class}>
		<h1>Gnosis SAFE</h1>
		{ maybeSafeAddress.value === undefined ? <SafeSelector_/> : <SafeManager_ safeAddress={maybeSafeAddress.value}/> }
	</div>
}

export function CreateSafe(model: {
	readonly wallet: ReadonlySignal<Wallet>
	readonly safeCreated: (safeAddress: bigint) => unknown
	readonly noticeError: (error: unknown) => unknown
}) {
	const { waitFor } = useAsyncState<bigint>().onResolved(model.safeCreated)
	const onClick = () => waitFor(async () => await createAndInitializeSafe(model.wallet.value.ethereumClient, model.wallet.value.address))
	return <span>Create a new Gnosis SAFE: <button onClick={onClick}>Create</button></span>
}

export function SafeManager(model: {
	readonly wallet: ReadonlySignal<Wallet>
	readonly safeAddress: ReadonlySignal<bigint>
	readonly noticeError: (error: unknown) => unknown
}) {
	const asyncSafeClient = useAsyncComputed(async () => await getSafeClient(model.wallet.value.ethereumClient, model.safeAddress.value))

	switch (asyncSafeClient.value.state) {
		case 'pending': return <Spinner/>
		case 'rejected':
			model.noticeError(asyncSafeClient.value.error)
			return <>⚠️</>
		case 'resolved': return <>
			<Recovery ethereumClient={model.wallet.value.ethereumClient} safeClient={asyncSafeClient.value.signal} noticeError={model.noticeError}/>
			<Signers safeClient={asyncSafeClient.value.signal} noticeError={model.noticeError}/>
		</>
	}
}

function Recovery(model: {
	readonly ethereumClient: IEthereumClient
	readonly safeClient: ReadonlySignal<SafeClient>
	readonly noticeError: (error: unknown) => unknown
}) {
	const firstRender = useSignal(true)
	const { value: asyncDelayModuleClients, refresh } = useAsyncRefreshable(async () => {
		const moduleAddresses = firstRender.value ? model.safeClient.value.modules : await model.safeClient.value.refreshModules()
		firstRender.value = false
		const clientPromises = moduleAddresses.map(moduleAddress => tryGetDelayModuleClients(model.ethereumClient, moduleAddress, model.safeClient.value.safeAddress))
		const clients = await Promise.all(clientPromises)
		return clients.flat().sort((a, b) => Number(a.cooldown) - Number(b.cooldown))
	}).onRejected(model.noticeError)

	const [RecovererList_] = useState(() => () => {
		const [Recoverer_] = useState(() => ({recoverer}: {recoverer: DelayModuleClient}) => {
			const remainingSeconds = useOptionalSignal<bigint>(undefined)
			const asyncRemainingSeconds = useAsyncComputed(() => recoverer.getRemainingCooldown(), { onRejected: model.noticeError, onResolved: x => remainingSeconds.deepValue = x })
			const [DaysRemaining_] = useState(() => () => <>{Number(recoverer.cooldown * 100n / 60n / 60n / 24n) / 100} Days - </>)
			const [Address_] = useState(() => () => <code>{addressBigintToHex(recoverer.recovererAddress)}</code>)
			const [RemoveButton_] = useState(() => () => {
				const safeClient = model.safeClient.value
				if (!safeClient.owned) return <></>
				const { value, waitFor } = useAsyncState<void>().onRejected(model.noticeError).onResolved(refresh)
				switch (value.value.state) {
					case 'inactive': return <CloseButton onClick={() => waitFor(async () => { await safeClient.removeModule(recoverer.moduleAddress) })}/>
					case 'pending': return <Spinner/>
					case 'rejected': return <>⚠️</>
					case 'resolved': return <></>
				}
			})
			const [StartButton_] = useState(() => () => {
				if (!recoverer.owned) return <></>
				const { value, waitFor } = useAsyncState<void>().onRejected(model.noticeError).onResolved(refresh)
				switch (asyncRemainingSeconds.value.state) {
					case 'pending': return <Spinner/>
					case 'rejected': return <>⚠️</>
					case 'resolved': {
						switch (value.value.state) {
							case 'inactive': return (asyncRemainingSeconds.value.value === undefined) ? <button onClick={() => waitFor(recoverer.queueRecovery)}>Start Recovery</button> : <></>
							case 'pending': return <Spinner/>
							case 'rejected': return <>⚠️</>
							case 'resolved': return <></>
						}
					}
				}
			})
			const [MaybeRecoveryInitiated_] = useState(() => () => {
				switch (asyncRemainingSeconds.value.state) {
					case 'pending': return <Spinner/>
					case 'rejected': return <>⚠️</>
					case 'resolved': {
						if (remainingSeconds.value === undefined) return <span style={{ fontSize: 'small', lineHeight: '1em' }}>↳ Recovery not initiated.</span>
						// TODO: add button to execute recoverey if cooldown remaining is 0
						else return <span>↳ ⚠️Recovery initiated!⚠️ <Countdown seconds={remainingSeconds.value}/> remaining until account is recovered.</span>
					}
				}
			})
			return <div style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
				<span><span><DaysRemaining_/><Address_/></span><RemoveButton_/><StartButton_/></span>
				<MaybeRecoveryInitiated_/>
			</div>
		})

		switch (asyncDelayModuleClients.value.state) {
			case 'rejected': return <>⚠️</>
			case 'pending': return <Spinner/>
			case 'resolved': return <>{ asyncDelayModuleClients.value.value.map(recoverer => <Recoverer_ recoverer={recoverer}/>) }</>
		}
	})
	const [AddRecoverer_] = useState(() => () => {
		const safeClient = model.safeClient.value
		if (!safeClient.owned) return <></>
		const maybeAddress = useOptionalSignal<bigint>(undefined)
		const maybeDelayDays = useOptionalSignal<bigint>(undefined)
		const { value, waitFor } = useAsyncState<void>().onRejected(model.noticeError).onResolved(refresh)
		const addRecoverer = () => {
			const address = maybeAddress.deepValue
			const delayDays = maybeDelayDays.deepValue
			if (address === undefined) return model.noticeError(`Missing recoverer address.`)
			if (delayDays === undefined) return model.noticeError(`Missing recovery delay.`)
			maybeAddress.clear()
			maybeDelayDays.clear()
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
				<button disabled={maybeAddress.value === undefined || maybeDelayDays.value === undefined} onClick={addRecoverer}>Add</button>
			</span>
		}
	})

	return <div class='subwidget'>
		<span><h1>Recoverers</h1><Refresh onClick={refresh}/></span>
		<div style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
			<RecovererList_/>
			<AddRecoverer_/>
		</div>
	</div>
}

function Signers(model: {
	readonly safeClient: ReadonlySignal<SafeClient>
	readonly noticeError: (error: unknown) => unknown
}) {
	const { value: asyncThreshold, waitFor: waitForThreshold } = useAsyncState<bigint>(model.safeClient.value.threshold).onRejected(model.noticeError)
	const { value: asyncOwners, waitFor: waitForOwners } = useAsyncState<bigint[]>(model.safeClient.value.owners).onRejected(model.noticeError)
	function refresh() {
		waitForThreshold(model.safeClient.value.refreshThreshold)
		waitForOwners(model.safeClient.value.refreshOwners)
	}

	const [ThresholdText_] = useState(() => () => {
		const fontSize = asyncOwners.value.state === 'resolved' && asyncOwners.value.value.length !== 1 ? 'xxx-large' : undefined
		switch (asyncThreshold.value.state) {
			case 'inactive': return <></> // unreachable
			case 'pending': return <Spinner/>
			case 'rejected': return <>⚠️</>
			case 'resolved': return <div style={{ paddingRight: '0.5em' }}><span style={{ fontSize, lineHeight: '0.75' }}>{asyncThreshold.value.value}</span><span>of</span></div>
		}
	})
	const [Signers_] = useState(() => () => {
		const [Signer_] = useState(() => ({ owner }: { owner: bigint }) => {
			const [Address_] = useState(() => () => <code>{addressBigintToHex(owner)}</code>)
			const [RemoveButton_] = useState(() => () => {
				const safeClient = model.safeClient.value
				if (!safeClient.owned) return <></>
				const { value, waitFor } = useAsyncState<void>().onRejected(model.noticeError).onResolved(refresh)
				const remove = () => waitFor(async () => { await safeClient.removeOwner(owner) })
				switch (value.value.state) {
					case 'inactive':
					case 'rejected': return <CloseButton onClick={remove}/>
					case 'pending': return <Spinner/>
					case 'resolved': return <></>
				}
			})
			return <span><Address_/><RemoveButton_/></span>
		})
		switch (asyncOwners.value.state) {
			case 'inactive': return <></>
			case 'pending': return <Spinner/>
			case 'rejected': return <>⚠️</>
			case 'resolved': return <div style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
				{ asyncOwners.value.value.map(owner => <Signer_ owner={owner}/>)}
			</div>
		}
	})
	const [AddSigner_] = useState(() => () => {
		const safeClient = model.safeClient.value
		if (!safeClient.owned) return <></>
		const maybeAddress = useOptionalSignal<bigint>(undefined)
		const { value, waitFor } = useAsyncState<void>().onRejected(model.noticeError).onResolved(refresh)
		const addSigner = () => {
			const address = maybeAddress.deepValue
			if (address === undefined) return model.noticeError(`Missing recoverer address.`)
			maybeAddress.clear()
			waitFor(async () => { await safeClient.addOwner(address) })
		}
		switch (value.value.state) {
			case 'pending': return <Spinner/>
			case 'resolved':
			case 'inactive': 
			case 'rejected': return <span>
				<AddressPicker address={maybeAddress} required extraOptions={savedWallets}/>
				<Spacer/>
				<button disabled={maybeAddress.value === undefined} onClick={addSigner}>Add</button>
			</span>
		}
	})

	return <div class='subwidget'>
		<span><h1>Signers</h1><Refresh onClick={refresh}/></span>
		<div>
			<ThresholdText_/>
			<Signers_/>
		</div>
		<AddSigner_/>
	</div>
}
