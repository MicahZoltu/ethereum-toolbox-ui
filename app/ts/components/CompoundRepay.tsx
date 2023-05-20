import { ReadonlySignal, Signal, useSignal, useSignalEffect } from "@preact/signals"
import { addressBigintToHex } from "@zoltu/ethereum-transactions/converters.js"
import { contract } from "micro-web3"
import { JSX } from "preact/jsx-runtime"
import { Wallet, toMicroWeb3 } from "../library/ethereum.js"
import { OptionalSignal, useAsyncState, useOptionalSignal } from "../library/preact-utilities.js"
import { bigintToDecimalString } from "../library/utilities.js"
import { AddressPicker } from "./AddressPicker.js"
import { FixedPointInput } from "./FixedPointInput.js"
import { Spinner } from "./Spinner.js"
import { Refresh } from "./Refresh.js"
import { useState } from "preact/hooks"

const CETH_REPAY_HELPER = 0xf859A1AD94BcF445A406B892eF0d3082f4174088n
const CETH_REPAY_HELPER_ABI = [{"constant":false,"inputs":[{"name":"borrower","type":"address"},{"name":"cEther_","type":"address"}],"name":"repayBehalfExplicit","outputs":[],"payable":true,"stateMutability":"payable","type":"function"}] as const
const CETH = 0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5n
const CETH_ABI = [{"constant":false,"inputs":[{"name":"account","type":"address"}],"name":"borrowBalanceCurrent","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"}] as const

export type CompoundRepayModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly style?: JSX.CSSProperties
}
export function CompoundRepay(model: CompoundRepayModel) {
	const maybeBorrower = useOptionalSignal<bigint>(undefined)
	const maybeDebtInAttoeth = useOptionalSignal<bigint>(undefined)
	const maybeAmountToRepay = useOptionalSignal<bigint>(undefined)
	const decimals = useSignal(18n)
	const debtError = useOptionalSignal<string>(undefined)
	const submitError = useOptionalSignal<string>(undefined)
	
	function reset() {
		maybeBorrower.clear()
		maybeDebtInAttoeth.clear()
		maybeAmountToRepay.clear()
		debtError.clear()
		submitError.clear()
	}

	const [BorrowerSelector_] = useState(() => () => <AddressPicker required address={maybeBorrower} extraOptions={[model.wallet.value.address]}/>)
	const [Suffix_] = useState(() => () => {
		const borrower = maybeBorrower.value
		if (borrower === undefined) return <></>
		const [Debt_] = useState(() => () => <CompoundDebt wallet={model.wallet} borrower={borrower} debtInAttoeth={maybeDebtInAttoeth} error={debtError}/>)
		const [RepaymentAmount_] = useState(() => () => <FixedPointInput required autoSize value={maybeAmountToRepay} decimals={decimals}/>)
		const [Submit_] = useState(() => () => {
			const amountToRepay = maybeAmountToRepay.value
			if (amountToRepay === undefined) return <></>
			return <PayDebtButton wallet={model.wallet} debtorAddress={borrower} amountToRepay={amountToRepay} error={submitError} sendComplete={reset}/>
		})
		return <>(<Debt_/>) up to <RepaymentAmount_/> <Submit_/></>
	})
	const [DebtQueryError_] = useState(() => () => <>{debtError.deepValue && <div style={{ color: 'red' }}>{debtError.deepValue}</div>}</>)
	const [SubmitError_] = useState(() => () => <>{submitError.deepValue && <div style={{ color: 'red' }}>{submitError.deepValue}</div>}</>)
	return <div style={model.style}>
		<div>Reopay debt of <BorrowerSelector_/> <Suffix_/></div>
		<DebtQueryError_/>
		<SubmitError_/>
	</div>
}

type CompoundDebt = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly borrower: Signal<bigint>
	readonly debtInAttoeth: OptionalSignal<bigint>
	readonly error: OptionalSignal<string>
}
function CompoundDebt(model: CompoundDebt) {
	const { value: debtAmount, waitFor: waitForDebtAmount } = useAsyncState<bigint>()
	function refresh() {
		model.error.clear()
		const microWeb3Provider = toMicroWeb3(model.wallet.value.ethereumClient)
		waitForDebtAmount(async () => await contract(CETH_ABI, microWeb3Provider, addressBigintToHex(CETH)).borrowBalanceCurrent.call(addressBigintToHex(model.borrower.peek())))
	}
	useSignalEffect(refresh)
	useSignalEffect(() => { model.debtInAttoeth.value === undefined && refresh() })
	useSignalEffect(() => { model.debtInAttoeth.deepValue = debtAmount.value.state === 'resolved' ? debtAmount.value.value : undefined })
	useSignalEffect(() => { model.error.deepValue = debtAmount.value.state === 'rejected' ? debtAmount.value.error.message : undefined })
	switch (debtAmount.value.state) {
		case 'inactive': return <Refresh onClick={refresh}/>
		case 'pending': return <Spinner/>
		case 'rejected': return <Refresh onClick={refresh}/>
		case 'resolved': return <span>{bigintToDecimalString(debtAmount.value.value, 18n)} <Refresh onClick={refresh}/></span>
	}
}

type PayDebtButtonModel = {
	readonly wallet: Signal<Wallet>
	readonly debtorAddress: ReadonlySignal<bigint>
	readonly amountToRepay: ReadonlySignal<bigint>
	readonly error: OptionalSignal<string>
	readonly sendComplete: () => void
}
function PayDebtButton(model: PayDebtButtonModel) {
	const { value: sendResult, waitFor: waitForSend } = useAsyncState()
	useSignalEffect(() => { model.error.deepValue = sendResult.value.state === 'rejected' ? sendResult.value.error.message : undefined })
	useSignalEffect(() => { sendResult.value.state === 'resolved' && model.sendComplete() })
	function submit() {
		waitForSend(async () => {
			if (model.wallet.value.readonly) throw new Error(`The selected wallet cannot send transactions.`)
			model.error.clear()
			const microWeb3Provider = toMicroWeb3(model.wallet.value.ethereumClient)
			await (await model.wallet.value.ethereumClient.sendTransaction({
				to: CETH_REPAY_HELPER,
				value: model.amountToRepay.value,
				data: contract(CETH_REPAY_HELPER_ABI, microWeb3Provider, addressBigintToHex(CETH_REPAY_HELPER)).repayBehalfExplicit.encodeInput({ borrower: addressBigintToHex(model.debtorAddress.value), cEther_: addressBigintToHex(CETH) }),
				gas: 500000n,
			})).waitForReceipt()
		})
	}
	return sendResult.value.state === 'pending'
		? <Spinner/>
		: <button onClick={submit} disabled={model.wallet.value.readonly || model.debtorAddress.value === undefined || model.amountToRepay.value === undefined}>Submit</button>
}
