import { ReadonlySignal, Signal, batch, useSignal, useSignalEffect } from "@preact/signals"
import { addressBigintToHex } from "@zoltu/ethereum-transactions/converters.js"
import { contract } from "micro-web3"
import { JSX } from "preact/jsx-runtime"
import { Wallet, toMicroWeb3 } from "../library/ethereum.js"
import { OptionalSignal, useAsyncState, useOptionalSignal } from "../library/preact-utilities.js"
import { bigintToDecimalString } from "../library/utilities.js"
import { FixedPointInput } from "./FixedPointInput.js"
import { Spinner } from "./Spinner.js"
import { useState } from "preact/hooks"

const COMPTROLLER = 0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3Bn
const COMPTROLLER_ABI = [
	{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"markets","outputs":[{"name":"isListed","type":"bool"},{"name":"collateralFactorMantissa","type":"uint256"},{"name":"isComped","type":"bool"}],"payable":false,"stateMutability":"view","type":"function","signature":"0x8e8f294b"},
	{"constant":true,"inputs":[{"name":"account","type":"address"}],"name":"getAccountLiquidity","outputs":[{"name":"error","type":"uint256"},{"name":"liquidity","type":"uint256"},{"name":"shortfall","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function","signature":"0x5ec88c79"},
] as const
const CETH = 0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5n
const CETH_ABI = [{"constant":false,"inputs":[{"name":"borrowAmount","type":"uint256"}],"name":"borrow","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"}] as const
// const CUSDC = 0x39AA39c021dfbaE8faC545936693aC917d5E7563n
const ORACLE = 0x50ce56A3239671Ab62f185704Caedf626352741en
const ORACLE_ABI = [{"inputs":[{"internalType":"address","name":"cToken","type":"address"}],"name":"getUnderlyingPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}] as const
export type CompoundBorrowModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly style?: JSX.CSSProperties
}
export function CompoundBorrow(model: CompoundBorrowModel) {
	const borrowLimit = useOptionalSignal<bigint>(undefined)
	const borrowAmount = useOptionalSignal<bigint>(undefined)
	const decimals = useSignal<bigint>(18n)
	const borrowLimitError = useOptionalSignal<string>(undefined)
	const borrowError = useOptionalSignal<string>(undefined)

	function reset() {
		borrowAmount.value = undefined
		borrowLimit.value = undefined
		borrowLimitError.value = undefined
		borrowError.value = undefined
	}
	const [BorrowAmount_] = useState(() => () => <FixedPointInput required autoSize value={borrowAmount} decimals={decimals}/>)
	const [BorrowLimit_] = useState(() => () => <BorrowLimit wallet={model.wallet} borrowLimit={borrowLimit} error={borrowLimitError}/>)
	const [BorrowButton_] = useState(() => () => borrowAmount.value === undefined ? <></> : <BorrowButton wallet={model.wallet} borrowAmount={borrowAmount.value} error={borrowError} sendComplete={reset}/>)
	const [BorrowLimitError_] = useState(() => () => <>{borrowLimitError.value && <div style={{ color: 'red' }}>{borrowLimitError.value}</div>}</>)
	const [BorrowError_] = useState(() => () => <>{borrowError.value && <div style={{ color: 'red' }}>{borrowError.value}</div>}</>)

	return <div style={model.style}>
		<div>Borrow <BorrowAmount_/> ETH (Max: <BorrowLimit_/> ETH) <BorrowButton_/></div>
		<BorrowLimitError_/>
		<BorrowError_/>
	</div>
}

type BorrowLimitModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly borrowLimit: OptionalSignal<bigint>
	readonly error: OptionalSignal<string>
}
function BorrowLimit(model: BorrowLimitModel) {
	const { value: borrowLimit, waitFor: waitForBorrowLimit } = useAsyncState<bigint>()
	function refresh() {
		model.error.clear()
		waitForBorrowLimit(async () => {
			const microWeb3Provider = toMicroWeb3(model.wallet.value.ethereumClient)
			const comptroller = contract(COMPTROLLER_ABI, microWeb3Provider, addressBigintToHex(COMPTROLLER))
			const oracle = contract(ORACLE_ABI, microWeb3Provider, addressBigintToHex(ORACLE))
			const liquidityAttousd = (await comptroller.getAccountLiquidity.call(addressBigintToHex(model.wallet.value.address))).liquidity
			const attoethPerUsd = await oracle.getUnderlyingPrice.call(addressBigintToHex(CETH))
			const borrowLimitAttoeth = liquidityAttousd * 10n**18n * 9n / attoethPerUsd / 10n
			return borrowLimitAttoeth
		})
	}
	useSignalEffect(() => { model.borrowLimit.value === undefined && refresh() })
	useSignalEffect(() => { borrowLimit.value.state === 'resolved' && (model.borrowLimit.deepValue = borrowLimit.value.value) })
	useSignalEffect(() => batch(() => { model.error.deepValue = borrowLimit.value.state === 'rejected' ? borrowLimit.value.error.message : undefined }))
	const [Refresh] = useState(() => () => <button onClick={refresh}>↻</button>)
	switch (borrowLimit.value.state) {
		case 'inactive': return <Refresh/>
		case 'pending': return <Spinner/>
		case 'rejected': return <Refresh/>
		case 'resolved': return <>{bigintToDecimalString(borrowLimit.value.value, 18n)} <Refresh/></>
	}
}

type BorrowButtonModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly borrowAmount: Signal<bigint>
	readonly error: OptionalSignal<string>
	readonly sendComplete: () => void
}
function BorrowButton(model: BorrowButtonModel) {
	const { value: sendResult, waitFor: waitForSend } = useAsyncState<void>()
	useSignalEffect(() => { model.error.deepValue = sendResult.value.state === 'rejected' ? sendResult.value.error.message : undefined })
	useSignalEffect(() => { sendResult.value.state === 'resolved' && model.sendComplete() })
	function submit() {
		waitForSend(async () => {
			if (model.wallet.value.readonly) throw new Error(`The selected wallet cannot send transactions.`)
			model.error.clear()
			const microWeb3Provider = toMicroWeb3(model.wallet.value.ethereumClient)
			await (await model.wallet.value.ethereumClient.sendTransaction({
				to: CETH,
				value: 0n,
				data: contract(CETH_ABI, microWeb3Provider, addressBigintToHex(CETH)).borrow.encodeInput(model.borrowAmount.value),
				gas: 300000n,
			})).waitForReceipt()
		})
	}
	return sendResult.value.state === 'pending'
		? <Spinner/>
		: <button onClick={submit}>Submit</button>
}
