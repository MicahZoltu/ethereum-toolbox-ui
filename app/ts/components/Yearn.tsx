import { ReadonlySignal, Signal, useComputed, useSignalEffect } from "@preact/signals"
import { addressBigintToHex, bigintToHex } from "@zoltu/ethereum-transactions/converters.js"
import { contract } from "micro-web3"
import { useState } from "preact/hooks"
import { JSX } from "preact/jsx-runtime"
import { savedWallets } from "../library/addresses.js"
import { ERC20_ABI, YEARN_VAULT_ABI, YEARN_VAULT_WETH_1_ADDRESS } from "../library/contract-details.js"
import { toMicroWeb3, Wallet } from "../library/ethereum.js"
import { useAsyncRefreshable, useAsyncState, useOptionalSignal } from "../library/preact-utilities.js"
import { WETH_DETAILS } from "../library/tokens.js"
import { bigintToDecimalString } from "../library/utilities.js"
import { EthTransactionReceiptResult } from "../library/wire-types.js"
import { AddressPicker } from "./AddressPicker.js"
import { FixedPointInput } from "./FixedPointInput.js"
import { Refresh } from "./Refresh.js"
import { Spacer } from "./Spacer.js"
import { Spinner } from "./Spinner.js"

const erc20 = contract(ERC20_ABI)
const vault = contract(YEARN_VAULT_ABI)
const decimals = new Signal(18n)

export interface DepositIntoVaultModel {
	readonly wallet: ReadonlySignal<Wallet>
	readonly noticeError: (error: unknown) => void
	readonly style?: JSX.CSSProperties
	readonly class?: JSX.HTMLAttributes['class']
}

export function DepositIntoVault(model: DepositIntoVaultModel) {
	const maybeAmount = useOptionalSignal<bigint>(undefined)

	function reset() {
		maybeAmount.clear()
	}

	const [Amount_] = useState(() => () => <FixedPointInput required autoSize value={maybeAmount} decimals={decimals}/>)
	const [ApproveAndDeposit_] = useState(() => () => {
		const amount = maybeAmount.value
		if (amount === undefined) return <></>
		return <ApproveAndDepositButton wallet={model.wallet} amount={amount} onComplete={reset} noticeError={model.noticeError}/>
	})

	return <div style={model.style} class={model.class}>
		<span>Deposit <Amount_/> WETH into yvWETH-1 Vault<Spacer/><ApproveAndDeposit_/></span>
	</div>
}

interface ApproveAndDepositButtonModel {
	readonly wallet: ReadonlySignal<Wallet>
	readonly amount: ReadonlySignal<bigint>
	readonly onComplete: () => void
	readonly noticeError: (error: unknown) => void
}

function ApproveAndDepositButton(model: ApproveAndDepositButtonModel) {
	const { value: needsApproval, refresh: refreshApproval } = useAsyncRefreshable(async () => {
		const amount = model.amount.value
		const wallet = model.wallet.value
		if (amount === 0n) return false
		const allowanceResult = await wallet.ethereumClient.call({
			to: WETH_DETAILS.address,
			data: erc20.allowance.encodeInput({ owner: addressBigintToHex(wallet.address), spender: addressBigintToHex(YEARN_VAULT_WETH_1_ADDRESS) })
		}, 'latest')
		const allowance = erc20.allowance.decodeOutput(allowanceResult)
		if (allowance >= amount) {
			return false
		}
		return true
	}).onRejected(model.noticeError)
	useSignalEffect(refreshApproval)

	const { value: approveResult, waitFor: waitForApprove, reset: resetApprove } = useAsyncState<EthTransactionReceiptResult>()
		.onRejected(model.noticeError)
		.onResolved(refreshApproval)
	const onApproveClick = () => waitForApprove(async () => {
		const wallet = model.wallet.value
		const amount = model.amount.value
		const transaction = {
			to: WETH_DETAILS.address,
			data: erc20.approve.encodeInput({ spender: addressBigintToHex(YEARN_VAULT_WETH_1_ADDRESS), amount: amount })
		}
		const result = await wallet.ethereumClient.sendTransaction(transaction)
		const receipt = await result.waitForReceipt()
		if (receipt === null) throw new Error(`No transactoin receipt found for transaction ${bigintToHex(result.transactionHash)}.`)
		if (receipt.status === 'failure') throw new Error(`Transaction mined but reverted, no changes made.`)
		return receipt
	})

	const { value: depositResult, waitFor: waitForDeposit, reset: resetDeposit } = useAsyncState<EthTransactionReceiptResult>()
		.onRejected(model.noticeError)
		.onResolved(model.onComplete)
	const onDepositClick = () => waitForDeposit(async () => {
		const wallet = model.wallet.value
		const amount = model.amount.value
		const recipient = wallet.address
		const transaction = {
			to: YEARN_VAULT_WETH_1_ADDRESS,
			data: vault.deposit.encodeInput({ assets: amount, receiver: addressBigintToHex(recipient) })
		}
		const result = await wallet.ethereumClient.sendTransaction(transaction)
		const receipt = await result.waitForReceipt()
		if (receipt === null) throw new Error(`No transactoin receipt found for transaction ${bigintToHex(result.transactionHash)}.`)
		if (receipt.status === 'failure') throw new Error(`Transaction mined but reverted, no changes made.`)
		return receipt
	})

	function reset() {
		refreshApproval()
		resetApprove()
		resetDeposit()
	}

	return needsApproval.value.state === 'pending' || approveResult.value.state === 'pending' || depositResult.value.state === 'pending' ? <Spinner/>
		: needsApproval.value.state === 'rejected' || approveResult.value.state === 'rejected' || depositResult.value.state === 'rejected' ? <Refresh onClick={reset}/>
		: needsApproval.value.value ? <button onClick={onApproveClick}>Approve</button>
		: <button onClick={onDepositClick}>Deposit</button>
}

export interface WithdrawFromVaultModel {
	readonly wallet: ReadonlySignal<Wallet>
	readonly noticeError: (error: unknown) => void
	readonly style?: JSX.CSSProperties
	readonly class?: JSX.HTMLAttributes['class']
}

export function WithdrawFromVault(model: WithdrawFromVaultModel) {
	const microWeb3Provider = useComputed(() => toMicroWeb3(model.wallet.value.ethereumClient))
	const yvWeth1 = useComputed(() => contract(YEARN_VAULT_ABI, microWeb3Provider.value, addressBigintToHex(YEARN_VAULT_WETH_1_ADDRESS)))
	const maybeAmount = useOptionalSignal<bigint>(undefined)
	const maybeReceiver = useOptionalSignal<bigint>(undefined)
	const { value: amountEth, refresh: refreshAmountEth } = useAsyncRefreshable(async () => {
		const amount = maybeAmount.deepValue
		if (amount === undefined) return undefined
		return await yvWeth1.value.convertToAssets.call(amount)
	}).onRejected(model.noticeError)
	useSignalEffect(refreshAmountEth)

	const { value: balance, refresh: refreshBalance } = useAsyncRefreshable(async () => await yvWeth1.value.balanceOf.call(addressBigintToHex(model.wallet.value.address)))
		.onRejected(model.noticeError)
	useSignalEffect(refreshBalance)

	function reset() {
		maybeAmount.clear()
		refreshBalance()
	}

	const [Amount_] = useState(() => () => {
		const style = useComputed(() => {
			if (balance.value.state !== 'resolved') return {}
			if (maybeAmount.deepValue === undefined) return {}
			if (maybeAmount.deepValue < balance.value.value) return {}
			return { color: 'red' }
		})
		return <FixedPointInput required autoSize value={maybeAmount} decimals={decimals} style={style}/>
	})
	const [AmountAssets_] = useState(() => () => {
		return amountEth.value.state === 'pending' ? <Spinner/>
			: amountEth.value.state === 'rejected' ? <Refresh onClick={refreshAmountEth}/>
			: amountEth.value.value === undefined ? <>?</>
			: <>{bigintToDecimalString(amountEth.value.value, 18n)}</>
	})
	const [VaultBalance_] = useState(() => () => {
		const [Refresh_] = useState(() => () => <Refresh onClick={refreshBalance}/>)
		switch (balance.value.state) {
			case 'pending': return <Spinner/>
			case 'rejected': return <Refresh_/>
			case 'resolved': return <span>{bigintToDecimalString(balance.value.value, 18n)} <Refresh_/></span>
		}
	})
	const [Recipient_] = useState(() => () => <AddressPicker required extraOptions={[model.wallet.value.address, ...savedWallets.value]} address={maybeReceiver}/>)
	const [WithdrawButton_] = useState(() => () => {
		const amount = maybeAmount.deepValue
		const recipient = maybeReceiver.deepValue
		if (amount === undefined) return <></>
		if (recipient === undefined) return <></>
		if (balance.value.state !== 'resolved') return <></>
		if (amount > balance.value.value) return <></>
		const { value: withdrawResult, waitFor: waitForWithdraw, reset: _resetWithdraw } = useAsyncState<void>()
			.onRejected(model.noticeError)
			.onResolved(reset)
		const onWithdrawClick = () => waitForWithdraw(async () => {
			if (model.wallet.value.readonly) throw new Error(`The selected wallet cannot send transactions.`)
			const receiver = addressBigintToHex(recipient)
			const owner = addressBigintToHex(model.wallet.value.address)
			const maxLoss = 0n // divisor of 10,000
			await (await model.wallet.value.ethereumClient.sendTransaction({
				to: YEARN_VAULT_WETH_1_ADDRESS,
				value: 0n,
				// TODO: switch away from micro-web3, maybe micro-eth-signer is its replacement?
				data: (yvWeth1.value as unknown as {'redeem(uint256,address,address,uint256)': typeof yvWeth1.value.redeem})['redeem(uint256,address,address,uint256)'].encodeInput({ shares: amount, receiver, owner, max_loss: maxLoss }),
			})).waitForReceipt()
		})

		return withdrawResult.value.state === 'pending' ? <Spinner/>
			: <button onClick={onWithdrawClick}>Withdraw</button>
	})

	return <div style={model.style} class={model.class}>
		<span>Withdraw <Amount_/> of <VaultBalance_/> assets as <AmountAssets_/> WETH from yvWETH-1 vault to <Recipient_/><Spacer/><WithdrawButton_/></span>
	</div>
}
