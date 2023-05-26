import { ReadonlySignal, Signal, computed } from "@preact/signals"
import { isArray } from "./typescript.js"
import { jsonParse, jsonStringify } from "./utilities.js"

const contractWalletsStorageKey = 'contract-wallets'
export const savedContractWallets: ReadonlySignal<readonly bigint[]> = new Signal<readonly bigint[]>(getAddresses(contractWalletsStorageKey))
export const rememberContractWalletAddress = (address: bigint) => rememberAddress(contractWalletsStorageKey, savedContractWallets, address)
export const forgetContractWalletAddress = (address: bigint) => forgetAddress(contractWalletsStorageKey, savedContractWallets, address)

const readonlyWalletsStorageKey = 'readonly-wallets'
export const savedReadonlyWallets: ReadonlySignal<readonly bigint[]> = new Signal<readonly bigint[]>(getAddresses(readonlyWalletsStorageKey))
export const rememberReadonlyWalletAddress = (address: bigint) => rememberAddress(readonlyWalletsStorageKey, savedReadonlyWallets, address)
export const forgetReadonlyWalletAddress = (address: bigint) => forgetAddress(readonlyWalletsStorageKey, savedReadonlyWallets, address)

const windowWalletsStorageKey = 'window-wallets'
export const savedWindowWallets: ReadonlySignal<readonly bigint[]> = new Signal<readonly bigint[]>(getAddresses(windowWalletsStorageKey))
export const rememberWindowWalletAddress = (address: bigint) => rememberAddress(windowWalletsStorageKey, savedWindowWallets, address)
export const forgetWindowWalletAddress = (address: bigint) => forgetAddress(windowWalletsStorageKey, savedWindowWallets, address)

export const forgetWalletAddress = (address: bigint) => {
	forgetContractWalletAddress(address)
	forgetReadonlyWalletAddress(address)
	forgetWindowWalletAddress(address)
}

export const savedWallets = computed(() => [...savedContractWallets.value, ...savedReadonlyWallets.value, ...savedWindowWallets.value])


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
