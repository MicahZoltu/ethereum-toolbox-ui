import { ReadonlySignal, Signal, computed } from "@preact/signals"
import { isArray } from "./typescript.js"
import { jsonParse, jsonStringify } from "./utilities.js"

const recoverableWalletsStorageKey = 'recoverable-wallets'
export const savedRecoverableWallets: ReadonlySignal<readonly bigint[]> = new Signal<readonly bigint[]>(getAddresses(recoverableWalletsStorageKey))
export const rememberRecoverableWalletAddress = (address: bigint) => rememberAddress(recoverableWalletsStorageKey, savedRecoverableWallets, address)
export const forgetRecoverableWalletAddress = (address: bigint) => forgetAddress(recoverableWalletsStorageKey, savedRecoverableWallets, address)

const safeWalletsStorageKey = 'safe-wallets'
export const savedSafeWallets: ReadonlySignal<readonly bigint[]> = new Signal<readonly bigint[]>(getAddresses(safeWalletsStorageKey))
export const rememberSafeWalletAddress = (address: bigint) => rememberAddress(safeWalletsStorageKey, savedSafeWallets, address)
export const forgetSafeWalletAddress = (address: bigint) => forgetAddress(safeWalletsStorageKey, savedSafeWallets, address)

const readonlyWalletsStorageKey = 'readonly-wallets'
export const savedReadonlyWallets: ReadonlySignal<readonly bigint[]> = new Signal<readonly bigint[]>(getAddresses(readonlyWalletsStorageKey))
export const rememberReadonlyWalletAddress = (address: bigint) => rememberAddress(readonlyWalletsStorageKey, savedReadonlyWallets, address)
export const forgetReadonlyWalletAddress = (address: bigint) => forgetAddress(readonlyWalletsStorageKey, savedReadonlyWallets, address)

const windowWalletsStorageKey = 'window-wallets'
export const savedWindowWallets: ReadonlySignal<readonly bigint[]> = new Signal<readonly bigint[]>(getAddresses(windowWalletsStorageKey))
export const rememberWindowWalletAddress = (address: bigint) => rememberAddress(windowWalletsStorageKey, savedWindowWallets, address)
export const forgetWindowWalletAddress = (address: bigint) => forgetAddress(windowWalletsStorageKey, savedWindowWallets, address)

const ledgerWalletsStorageKey = 'ledger-wallets'
export const savedLedgerWallets: ReadonlySignal<readonly bigint[]> = new Signal<readonly bigint[]>(getAddresses(ledgerWalletsStorageKey))
export const rememberLedgerWalletAddress = (address: bigint) => rememberAddress(ledgerWalletsStorageKey, savedLedgerWallets, address)
export const forgetLedgerWalletAddress = (address: bigint) => forgetAddress(ledgerWalletsStorageKey, savedLedgerWallets, address)

export const forgetWalletAddress = (address: bigint) => {
	forgetRecoverableWalletAddress(address)
	forgetSafeWalletAddress(address)
	forgetReadonlyWalletAddress(address)
	forgetWindowWalletAddress(address)
	forgetLedgerWalletAddress(address)
}

export const savedWallets = computed(() => [...savedRecoverableWallets.value, ...savedSafeWallets.value, ...savedReadonlyWallets.value, ...savedWindowWallets.value, ...savedLedgerWallets.value])


function getAddresses(storageKey: string) {
	const stored = window.localStorage.getItem(storageKey)
	if (stored === null) {
		return []
	}
	const parsed = jsonParse(stored)
	if (!isArray(parsed)) {
		window.localStorage.removeItem(storageKey)
		return []
	}
	if (!parsed.every((item): item is bigint => typeof item === 'bigint')) {
		const filtered = parsed.filter((item): item is bigint => typeof item === 'bigint')
		window.localStorage.setItem(storageKey, jsonStringify(filtered))
		return filtered
	}
	return parsed
}

function rememberAddress(storageKey: string, signal: Signal<readonly bigint[]>, address: bigint) {
	const updated = signal.value.concat(address)
	window.localStorage.setItem(storageKey, jsonStringify(updated))
	// always tail call setting this
	signal.value = updated
}

function forgetAddress(storageKey: string, signal: Signal<readonly bigint[]>, address: bigint) {
	const filtered = signal.value.filter(item => item !== address)
	window.localStorage.setItem(storageKey, jsonStringify(filtered))
	signal.value = filtered
}
