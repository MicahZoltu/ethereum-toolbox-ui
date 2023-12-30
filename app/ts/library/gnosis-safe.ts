import { keccak_256 } from '@noble/hashes/sha3'
import { addressBigintToHex, addressHexToBigint, bigintToBytes, bytesToBigint, hexToBytes } from "@zoltu/ethereum-transactions/converters.js"
import { contract } from 'micro-web3'
import { GNOSIS_SAFE_ABI, GNOSIS_SAFE_DELAY_MODULE_ABI, GNOSIS_SAFE_DELAY_MODULE_MASTER_ADDRESS, GNOSIS_SAFE_DELAY_MODULE_PROXY_FACTORY_ABI, GNOSIS_SAFE_DELAY_MODULE_PROXY_FACTORY_ADDRESS, GNOSIS_SAFE_FALLBACK_HANDLER_ADDRESS, GNOSIS_SAFE_MASTER_ADDRESS, GNOSIS_SAFE_PROXY_FACTORY_ABI, GNOSIS_SAFE_PROXY_FACTORY_ADDRESS, MULTISEND_CALL_ABI, MULTISEND_CALL_ADDRESS } from "../library/contract-details.js"
import { PermitUnion, ResolvePromise } from "../library/typescript.js"
import { IEthereumClient } from './ethereum.js'

// this is relatively expensive to instantiate and it is pure so we can just reuse this one instance
const safeFactoryContract = contract(GNOSIS_SAFE_PROXY_FACTORY_ABI)
const safeContract = contract(GNOSIS_SAFE_ABI)
const multisendContract = contract(MULTISEND_CALL_ABI)
const delayModuleContract = contract(GNOSIS_SAFE_DELAY_MODULE_ABI)
const delayModuleProxyFactoryContract = contract(GNOSIS_SAFE_DELAY_MODULE_PROXY_FACTORY_ABI)

export async function createAndInitializeSafe(ethereumClient: IEthereumClient, ownerAddress: bigint) {
	const initializer = safeContract.setup.encodeInput({
		_owners: [addressBigintToHex(ownerAddress)],
		_threshold: 1n,
		to: addressBigintToHex(0n),
		data: new Uint8Array(0),
		fallbackHandler: addressBigintToHex(GNOSIS_SAFE_FALLBACK_HANDLER_ADDRESS),
		paymentToken: addressBigintToHex(0n),
		payment: 0n,
		paymentReceiver: addressBigintToHex(0n),
	})
	const result = await ethereumClient.sendTransaction({
		to: GNOSIS_SAFE_PROXY_FACTORY_ADDRESS,
		data: safeFactoryContract.createProxyWithNonce.encodeInput({ _singleton: addressBigintToHex(GNOSIS_SAFE_MASTER_ADDRESS), initializer, saltNonce: BigInt(Math.round(Date.now() / 1000)) }),
	})
	// event ProxyCreation(GnosisSafeProxy proxy, address singleton)
	const receipt = await result.waitForReceipt()
	const log = receipt.logs.find(log => log.address === GNOSIS_SAFE_PROXY_FACTORY_ADDRESS && log.topics[0] === 0x4f51faf6c4561ff95f067657e43439f0f856d97c04d9ec9070a6199ad418e235n && bytesToBigint(log.data.slice(0, 32)) !== 0n)
	if (log === undefined) throw new Error(`Expected ProxyCreation event not found.`)
	const safeAddress = bytesToBigint(log.data.slice(0, 32))
	return safeAddress
}

export async function createAndInitializeRecoverer(safeClient: OwnedSafeClient, recoveryAddress: bigint, cooldown: bigint) {
	function calculateDelayModuleProxyAddress(initializer: Uint8Array, saltNonce: bigint) {
		const initCode = Uint8Array.from([...hexToBytes('0x602d8060093d393df3363d3d373d3d3d363d73'), ...bigintToBytes(GNOSIS_SAFE_DELAY_MODULE_MASTER_ADDRESS, 20), ...hexToBytes('0x5af43d82803e903d91602b57fd5bf3')])
		const initCodeHash = keccak_256(initCode)
		const deployerAddressBytes = bigintToBytes(GNOSIS_SAFE_DELAY_MODULE_PROXY_FACTORY_ADDRESS, 20)
		const saltBytes = keccak_256(Uint8Array.from([...keccak_256(initializer), ...bigintToBytes(saltNonce, 32)]))
		const delayModuleProxyAddress = bytesToBigint(keccak_256(Uint8Array.from([0xff, ...deployerAddressBytes, ...saltBytes, ...initCodeHash])).slice(12))
		return delayModuleProxyAddress
	}
	
	// create transaction to deploy the delay module proxy
	const ownerBytes = bigintToBytes(safeClient.safeAddress, 32)
	const avatarBytes = bigintToBytes(safeClient.safeAddress, 32)
	const targetBytes = bigintToBytes(safeClient.safeAddress, 32)
	const cooldownBytes = bigintToBytes(cooldown, 32)
	const expirationBytes = new Uint8Array(32)
	const delayModuleProxyDeployInitializer = delayModuleContract.setUp.encodeInput(Uint8Array.from([...ownerBytes, ...avatarBytes, ...targetBytes, ...cooldownBytes, ...expirationBytes]))
	const saltNonce = BigInt(Date.now())
	const delayModuleProxyDeployData = delayModuleProxyFactoryContract.deployModule.encodeInput({ masterCopy: addressBigintToHex(GNOSIS_SAFE_DELAY_MODULE_MASTER_ADDRESS), initializer: delayModuleProxyDeployInitializer, saltNonce })
	const delayModuleProxyAddress = calculateDelayModuleProxyAddress(delayModuleProxyDeployInitializer, saltNonce)

	await safeClient.multisend([
		{ to: GNOSIS_SAFE_DELAY_MODULE_PROXY_FACTORY_ADDRESS, value: 0n, data: delayModuleProxyDeployData },
		{ to: safeClient.safeAddress, value: 0n, data: safeContract.enableModule.encodeInput(addressBigintToHex(delayModuleProxyAddress)) },
		{ to: delayModuleProxyAddress, value: 0n, data: delayModuleContract.enableModule.encodeInput(addressBigintToHex(recoveryAddress)) },
	])

	return delayModuleProxyAddress
}

export async function tryGetDelayModuleClients(ethereumClient: IEthereumClient, delayModuleAddress: bigint, safeAddress: bigint) {
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
		const queuedAt = delayModuleContract.getTxCreatedAt.decodeOutput(result)
		if (queuedAt === 0n) return undefined
		const cooldown = await cooldownPromise
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
export type OwnedDelayModuleClient = PermitUnion<ResolvePromise<ReturnType<typeof tryGetDelayModuleClients>>[number], { owned: true }>
export type UnownedDelayModuleClient = PermitUnion<ResolvePromise<ReturnType<typeof tryGetDelayModuleClients>>[number], { owned: false }>
export type DelayModuleClient = OwnedDelayModuleClient | UnownedDelayModuleClient

export async function getSafeClient(ethereumClient: IEthereumClient, safeAddress: bigint) {
	// Read Functions
	async function isOwner(address: bigint) {
		const result = await ethereumClient.call({
			to: safeAddress,
			data: safeContract.isOwner.encodeInput(addressBigintToHex(address))
		}, 'latest')
		return safeContract.isOwner.decodeOutput(result)
	}
	
	async function getOwners() {
		const result = await ethereumClient.call({
			to: safeAddress,
			data: safeContract.getOwners.encodeInput({}),
		}, 'latest')
		return safeContract.getOwners.decodeOutput(result).map(addressHexToBigint)
	}

	async function getThreshold() {
		const result = await ethereumClient.call({
			to: safeAddress,
			data: safeContract.getThreshold.encodeInput({}),
		}, 'latest')
		return safeContract.getThreshold.decodeOutput(result)
	}
	
	async function getModules() {
		const modules: bigint[] = []
		// modules are stored as a linked list with the first item being at mapping(1)
		let nextModule = 1n
		const pageSize = 100n
		do {
			const result = await ethereumClient.call({
				to: safeAddress,
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

	async function isModuleEnabled(moduleAddress: bigint) {
		const result = await ethereumClient.call({
			to: safeAddress,
			value: 0n,
			data: safeContract.isModuleEnabled.encodeInput(addressBigintToHex(moduleAddress))
		}, 'latest')
		return safeContract.isModuleEnabled.decodeOutput(result)
	}

	// Write Functions
	async function addModule(moduleAddress: bigint) {
		const result = await ethereumClient.sendTransaction({
			to: safeAddress,
			value: 0n,
			data: safeContract.enableModule.encodeInput(addressBigintToHex(moduleAddress)),
		})
		return await result.waitForReceipt()
	}
	
	async function removeModule(moduleAddress: bigint) {
		// find the module we want to remove in the on-chain linked list of enabled modules
		const modules = await getModules()
		const moduleIndex = modules.findIndex(x => x === moduleAddress)
		if (moduleIndex === -1) throw new Error(`Module with address ${addressBigintToHex(moduleAddress)} is not a module for this SAFE.`)
		// non-null assertion is here because we are certain that moduleIndex is a valid index in this array, and that the array is not sparse, and in the case where it is 0 we return a hard coded value
		const prevModule = moduleIndex === 0 ? 1n : modules[moduleIndex - 1]!
	
		// remove the module
		const result = await ethereumClient.sendTransaction({
			to: safeAddress,
			value: 0n,
			data: safeContract.disableModule.encodeInput({ prevModule: addressBigintToHex(prevModule), module: addressBigintToHex(moduleAddress) }),
		})
		return await result.waitForReceipt()
	}

	async function addOwner(ownerAddress: bigint) {
		const result = await ethereumClient.sendTransaction({
			to: safeAddress,
			data: safeContract.addOwnerWithThreshold.encodeInput({ owner: addressBigintToHex(ownerAddress), _threshold: 1n })
		})
		return await result.waitForReceipt()
	}

	async function removeOwner(ownerAddress: bigint) {
		// find the owner in linked list
		const owners = await getOwners()
		const ownerIndex = owners.findIndex(item => item === ownerAddress)
		const previousOwner = ownerIndex === 0 ? 1n : owners[ownerIndex - 1]!

		// remove the owner
		const result = await ethereumClient.sendTransaction({
			to: safeAddress,
			data: safeContract.removeOwner.encodeInput({ prevOwner: addressBigintToHex(previousOwner), owner: addressBigintToHex(ownerAddress), _threshold: 1n }),
		})
		return await result.waitForReceipt()
	}

	async function multisend(transactions: readonly { readonly to: bigint, readonly value: bigint, readonly data: Uint8Array }[]) {
		const transactionsBytes = Uint8Array.from([...transactions.flatMap(transaction => [0x00, ...bigintToBytes(transaction.to, 20), ...bigintToBytes(transaction.value, 32), ...bigintToBytes(BigInt(transaction.data.length), 32), ...transaction.data])])
		const transaction = {
			to: MULTISEND_CALL_ADDRESS,
			operation: 'DELEGATECALL', // operation isn't part of sendTransaction parameters according to TypeScript; it is a hidden optional parameter only by SAFE wallets
			data: multisendContract.multiSend.encodeInput(transactionsBytes),
		}
		const result = await ethereumClient.sendTransaction(transaction)
		return await result.waitForReceipt()
	}

	const error = new Error(`${addressBigintToHex(safeAddress)} does not appear to be a valid Gnosis SAFE.`)
	try {
		const ownersPromise = getOwners()
		const thresholdPromise = getThreshold()
		const modulesPromise = getModules()
		let owners = await ownersPromise
		let threshold = await thresholdPromise
		let modules = await modulesPromise
		// TODO: check other functions that we care about
		if (owners.length === 0 || threshold === 0n) throw error
		const client = { owned: false, safeAddress, threshold, owners, modules, isOwner, refreshOwners: async () => owners = await getOwners(), refreshThreshold: async () => threshold = await getThreshold(), refreshModules: async () => modules = await getModules(), isModuleEnabled } as const
		if (ethereumClient.address !== safeAddress || threshold !== 1n) return client
		return { ...client, owned: true, addModule, removeModule, addOwner, removeOwner, multisend } as const
	} catch {
		throw error
	}
}
export type OwnedSafeClient = PermitUnion<ResolvePromise<ReturnType<typeof getSafeClient>>, { owned: true }>
export type UnownedSafeClient = PermitUnion<ResolvePromise<ReturnType<typeof getSafeClient>>, { owned: false }>
export type SafeClient = OwnedSafeClient | UnownedSafeClient
