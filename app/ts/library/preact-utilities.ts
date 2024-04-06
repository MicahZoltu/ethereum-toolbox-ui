import { ReadonlySignal, Signal, batch, useSignal, useSignalEffect } from '@preact/signals'
import { useMemo } from 'preact/hooks'
import { OmitUnion } from './typescript.js'
import { ensureError } from './utilities.js'

export type Inactive = { state: 'inactive' }
export type Pending = { state: 'pending' }
export type Resolved<T> = { state: 'resolved', value: T, signal: Signal<T> }
export type Rejected = { state: 'rejected', error: Error }
export type AsyncProperty<T> = Inactive | Pending | Resolved<T> | Rejected
export type AsyncState<T> = {
	value: ReadonlySignal<AsyncProperty<T>>,
	waitFor: (resolver: () => Promise<T>) => void,
	reset: () => void,
	onInactive: (callback: () => unknown) => AsyncState<T>
	onPending: (callback: () => unknown) => AsyncState<T>
	onResolved: (callback: (value: T) => unknown) => AsyncState<T>
	onRejected: (callback: (error: Error) => unknown) => AsyncState<T>
}
export type Callbacks<T> = {
	onInactive?: () => unknown
	onPending?: () => unknown
	onResolved?: (value: T) => unknown
	onRejected?: (error: Error) => unknown
}

export function useAsyncState<T>(initialValue?: T, callbacks?: Callbacks<T>): AsyncState<T> {
	let onInactive: (() => unknown) | undefined = callbacks?.onInactive
	let onPending: (() => unknown) | undefined = callbacks?.onPending
	let onRejected: ((error: Error) => unknown) | undefined = callbacks?.onRejected
	let onResolved: ((value: T) => unknown) | undefined = callbacks?.onResolved

	function getCaptureAndCancelOthers() {
		// delete previously captured signal so any pending async work will no-op when they resolve
		delete captureContainer.peek().result
		// capture the signal in a new object so we can delete it later if it is interrupted
		captureContainer.value = { result }
		return captureContainer.peek()
	}

	async function activate(resolver: () => Promise<T>) {
		const capture = getCaptureAndCancelOthers()
		// we need to read the property out of the capture every time we look at it, in case it is deleted asynchronously
		function setCapturedResult(newResult: AsyncProperty<T>) {
			const result = capture.result
			if (result === undefined) return
			result.value = newResult
		}
		try {
			const pendingState = { state: 'pending' as const }
			setCapturedResult(pendingState)
			onPending && onPending()
			const resolvedValue = await resolver()
			innerSignal.deepValue = resolvedValue
			const resolvedState = { state: 'resolved' as const, value: resolvedValue, signal: innerSignal.value! }
			setCapturedResult(resolvedState)
			onResolved && onResolved(resolvedValue)
		} catch (unknownError: unknown) {
			const error = ensureError(unknownError)
			const rejectedState = { state: 'rejected' as const, error }
			setCapturedResult(rejectedState)
			onRejected && onRejected(error)
		}
	}

	function reset() {
		const result = getCaptureAndCancelOthers().result
		if (result === undefined) return
		result.value = { state: 'inactive' }
		onInactive && onInactive()
	}

	const innerSignal = useOptionalSignal<T>(initialValue === undefined ? undefined : initialValue)
	const result = useSignal<AsyncProperty<T>>(initialValue === undefined ? { state: 'inactive' } : { state: 'resolved', value: innerSignal.deepValue!, signal: innerSignal.value! })
	const captureContainer = useSignal<{ result?: Signal<AsyncProperty<T>> }>({})

	const asyncState: AsyncState<T> = {
		value: result,
		waitFor: resolver => activate(resolver),
		reset,
		onInactive: callback => { onInactive = callback; return asyncState },
		onPending: callback => { onPending = callback; return asyncState },
		onRejected: callback => { onRejected = callback; return asyncState },
		onResolved: callback => { onResolved = callback; return asyncState },
	}
	return asyncState
}

/**
 * @param compute Async function.  Any signals you want tracked must have their .value read *before* the first await of the function.
 * @param callbacks Optional callbacks to be called when various states are reached.  These are called after the signal value is updated.
 * @returns
 */
export function useAsyncComputed<T>(compute: () => Promise<T>, callbacks?: Callbacks<T>): ReadonlySignal<Pending | Resolved<T> | Rejected> {
	const { value, waitFor, onInactive, onPending, onRejected, onResolved } = useAsyncState<T>()
	if (callbacks?.onInactive) onInactive(callbacks.onInactive)
	if (callbacks?.onPending) onPending(callbacks.onPending)
	if (callbacks?.onRejected) onRejected(callbacks.onRejected)
	if (callbacks?.onResolved) onResolved(callbacks.onResolved)
	useSignalEffect(() => waitFor(compute))
	// we strip off the `inactive` here because `reset` isn't exposed externally and we have moved into the `pending` state already by this point, so 'inactive' is unreachable
	return value as ReadonlySignal<Pending | Resolved<T> | Rejected>
}

export type RefreshableAsyncState<T> = {
	value: ReadonlySignal<OmitUnion<AsyncProperty<T>, { state: 'inactive' }>>
	refresh: () => unknown,
	onPending: (callback: () => unknown) => RefreshableAsyncState<T>
	onResolved: (callback: (value: T) => unknown) => RefreshableAsyncState<T>
	onRejected: (callback: (error: Error) => unknown) => RefreshableAsyncState<T>
}
export function useAsyncRefreshable<T>(refresher: () => Promise<T>): RefreshableAsyncState<T> {
	const asyncState = useAsyncState<T>()
	const refresh = () => asyncState.waitFor(refresher)
	useMemo(refresh, [])
	const refreshableAsyncState: RefreshableAsyncState<T> = {
		// typecast here because we know that `inactive` is unreachable since `reset` is never called and `refresh` is called immediately
		value: asyncState.value as ReadonlySignal<OmitUnion<AsyncProperty<T>, {state: 'inactive'}>>,
		refresh,
		onPending: callback => { asyncState.onPending(callback); return refreshableAsyncState },
		onResolved: callback => { asyncState.onResolved(callback); return refreshableAsyncState },
		onRejected: callback => { asyncState.onRejected(callback); return refreshableAsyncState },
	}
	return refreshableAsyncState
}

export class OptionalSignal<T> extends Signal<Signal<T> | undefined> implements ReadonlySignal<Signal<T> | undefined> {
	private inner: Signal<T> | undefined

	public constructor(value: Signal<T> | T | undefined, startUndefined?: boolean) {
		super(value === undefined || startUndefined === true ? undefined : value instanceof Signal ? value : new Signal(value))
		this.set = this.set.bind(this)
		if (this.value instanceof Signal) this.inner = this.value
	}

	public get deepValue() {
		const inner = this.value
		if (inner === undefined) return undefined
		else return inner.value
	}

	public set deepValue(newValue: T | undefined) {
		if (newValue === undefined) {
			this.value = undefined
		} else {
			batch(() => {
				if (this.inner === undefined) this.inner = new Signal(newValue)
				else this.inner.value = newValue
				this.value = this.inner
			})
		}
	}

	public readonly deepPeek = () => {
		const inner = this.peek()
		if (inner === undefined) return undefined
		else return inner.peek()
	}

	public readonly clear = () => this.value = undefined
	
	// convenience function for when you want pass a setter to a function; note that this is `this` bound in the constructor
	public set(newValue: T | undefined) { this.deepValue = newValue }
}

export function useOptionalSignal<T>(value: Signal<T> | T | undefined, startUndefined?: boolean) {
	return useMemo(() => new OptionalSignal<T>(value, startUndefined), []);
}
