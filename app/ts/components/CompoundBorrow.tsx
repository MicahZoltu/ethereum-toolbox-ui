import { ReadonlySignal, Signal, useSignal, useSignalEffect } from "@preact/signals"
import { addressBigintToHex } from "../library/converters.js"
import { createContract } from 'micro-eth-signer/advanced/abi.js'
import { useState } from "preact/hooks"
import { JSX } from "preact/jsx-runtime"
import { Wallet, toMicroEthSigner } from "../library/ethereum.js"
import { OptionalSignal, useAsyncState, useOptionalSignal } from "../library/preact-utilities.js"
import { bigintToDecimalString } from "../library/utilities.js"
import { FixedPointInput } from "./FixedPointInput.js"
import { Refresh } from "./Refresh.js"
import { Spacer } from "./Spacer.js"
import { Spinner } from "./Spinner.js"

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
	readonly noticeError: (error: unknown) => void
	readonly style?: JSX.CSSProperties
	readonly class?: JSX.HTMLAttributes['class']
}
export function CompoundBorrow(model: CompoundBorrowModel) {
	const borrowLimit = useOptionalSignal<bigint>(undefined)
	const borrowAmount = useOptionalSignal<bigint>(undefined)
	const decimals = useSignal<bigint>(18n)

	function reset() {
		borrowAmount.value = undefined
		borrowLimit.value = undefined
	}
	const [BorrowAmount_] = useState(() => () => <FixedPointInput required autoSize value={borrowAmount} decimals={decimals}/>)
	const [BorrowLimit_] = useState(() => () => <BorrowLimit wallet={model.wallet} borrowLimit={borrowLimit} noticeError={model.noticeError}/>)
	const [BorrowButton_] = useState(() => () => borrowAmount.value === undefined ? <></> : <BorrowButton wallet={model.wallet} borrowAmount={borrowAmount.value} noticeError={model.noticeError} sendComplete={reset}/>)

	return <div style={model.style} class={model.class}>
		<span>Borrow <BorrowAmount_/> ETH (Max: <BorrowLimit_/> ETH)<Spacer/><BorrowButton_/></span>
	</div>
}

type BorrowLimitModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly borrowLimit: OptionalSignal<bigint>
	readonly noticeError: (error: unknown) => void
}
function BorrowLimit(model: BorrowLimitModel) {
	const { value: borrowLimit, waitFor: waitForBorrowLimit } = useAsyncState<bigint>()
	function refresh() {
		waitForBorrowLimit(async () => {
			const microWeb3Provider = toMicroEthSigner(model.wallet.value.ethereumClient)
			const comptroller = createContract(COMPTROLLER_ABI, microWeb3Provider, addressBigintToHex(COMPTROLLER))
			const oracle = createContract(ORACLE_ABI, microWeb3Provider, addressBigintToHex(ORACLE))
			const liquidityAttousd = (await comptroller.getAccountLiquidity.call(addressBigintToHex(model.wallet.value.address))).liquidity
			const attoethPerUsd = await oracle.getUnderlyingPrice.call(addressBigintToHex(CETH))
			const borrowLimitAttoeth = liquidityAttousd * 10n**18n * 9n / attoethPerUsd / 10n
			return borrowLimitAttoeth
		})
	}
	useSignalEffect(() => { model.borrowLimit.value === undefined && refresh() })
	useSignalEffect(() => { borrowLimit.value.state === 'resolved' && (model.borrowLimit.deepValue = borrowLimit.value.value) })
	useSignalEffect(() => { borrowLimit.value.state === 'rejected' && model.noticeError(borrowLimit.value.error) })
	const [Refresh_] = useState(() => () => <Refresh onClick={refresh}/>)
	switch (borrowLimit.value.state) {
		case 'inactive': return <Refresh_/>
		case 'pending': return <Spinner/>
		case 'rejected': return <Refresh_/>
		case 'resolved': return <>{bigintToDecimalString(borrowLimit.value.value, 18n)} <Refresh_/></>
	}
}

type BorrowButtonModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly borrowAmount: Signal<bigint>
	readonly noticeError: (error: unknown) => void
	readonly sendComplete: () => void
}
function BorrowButton(model: BorrowButtonModel) {
	const { value: sendResult, waitFor: waitForSend } = useAsyncState<void>()
	useSignalEffect(() => { sendResult.value.state === 'rejected' && model.noticeError(sendResult.value.error) })
	useSignalEffect(() => { sendResult.value.state === 'resolved' && model.sendComplete() })
	function submit() {
		waitForSend(async () => {
			if (model.wallet.value.readonly) throw new Error(`The selected wallet cannot send transactions.`)
			const microWeb3Provider = toMicroEthSigner(model.wallet.value.ethereumClient)
			await (await model.wallet.value.ethereumClient.sendTransaction({
				to: CETH,
				value: 0n,
				data: createContract(CETH_ABI, microWeb3Provider, addressBigintToHex(CETH)).borrow.encodeInput(model.borrowAmount.value),
			})).waitForReceipt()
		})
	}
	return sendResult.value.state === 'pending'
		? <Spinner/>
		: <button onClick={submit} style={{  marginLeft: 'auto'}}>Submit</button>
}
