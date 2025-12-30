import { ReadonlySignal, Signal, useSignal, useSignalEffect } from "@preact/signals"
import { addressBigintToHex } from "../library/converters.js"
import { createContract } from "micro-eth-signer/advanced/abi.js"
import { CSSProperties, HTMLAttributes } from "preact"
import { useState } from "preact/hooks"
import { savedWallets } from "../library/addresses.js"
import { Wallet, toMicroEthSigner } from "../library/ethereum.js"
import { OptionalSignal, useAsyncState, useOptionalSignal } from "../library/preact-utilities.js"
import { bigintToDecimalString } from "../library/utilities.js"
import { AddressPicker } from "./AddressPicker.js"
import { FixedPointInput } from "./FixedPointInput.js"
import { Refresh } from "./Refresh.js"
import { Spacer } from "./Spacer.js"
import { Spinner } from "./Spinner.js"

const CETH_REPAY_HELPER = 0xf859A1AD94BcF445A406B892eF0d3082f4174088n
const CETH_REPAY_HELPER_ABI = [{"constant":false,"inputs":[{"name":"borrower","type":"address"},{"name":"cEther_","type":"address"}],"name":"repayBehalfExplicit","outputs":[],"payable":true,"stateMutability":"payable","type":"function"}] as const
const CETH = 0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5n
const CETH_ABI = [{"constant":false,"inputs":[{"name":"account","type":"address"}],"name":"borrowBalanceCurrent","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"}] as const

export type CompoundRepayModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly noticeError: (error: unknown) => void
	readonly style?: CSSProperties
	readonly class?: HTMLAttributes['class']
}
export function CompoundRepay(model: CompoundRepayModel) {
	const maybeBorrower = useOptionalSignal<bigint>(undefined)
	const maybeDebtInAttoeth = useOptionalSignal<bigint>(undefined)
	const maybeAmountToRepay = useOptionalSignal<bigint>(undefined)
	const decimals = useSignal(18n)
	
	function reset() {
		maybeBorrower.clear()
		maybeDebtInAttoeth.clear()
		maybeAmountToRepay.clear()
	}

	const [BorrowerSelector_] = useState(() => () => <AddressPicker required address={maybeBorrower} extraOptions={[model.wallet.value.address, ...savedWallets.value]}/>)
	const [Suffix_] = useState(() => () => {
		const borrower = maybeBorrower.value
		if (borrower === undefined) return <></>
		const [Debt_] = useState(() => () => <CompoundDebt wallet={model.wallet} borrower={borrower} debtInAttoeth={maybeDebtInAttoeth} noticeError={model.noticeError}/>)
		const [RepaymentAmount_] = useState(() => () => <FixedPointInput required autoSize value={maybeAmountToRepay} decimals={decimals}/>)
		const [Submit_] = useState(() => () => {
			const amountToRepay = maybeAmountToRepay.value
			if (amountToRepay === undefined) return <></>
			return <PayDebtButton wallet={model.wallet} debtorAddress={borrower} amountToRepay={amountToRepay} noticeError={model.noticeError} sendComplete={reset}/>
		})
		return <><span style={{ gap: 0 }}>(<Debt_/>)</span> up to <RepaymentAmount_/><Spacer/><Submit_/></>
	})
	return <div style={model.style} class={model.class}>
		<span>Repay debt of <BorrowerSelector_/><Suffix_/></span>
	</div>
}

type CompoundDebt = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly borrower: Signal<bigint>
	readonly debtInAttoeth: OptionalSignal<bigint>
	readonly noticeError: (error: unknown) => void
}
function CompoundDebt(model: CompoundDebt) {
	const { value: debtAmount, waitFor: waitForDebtAmount } = useAsyncState<bigint>()
	function refresh() {
		const microEthSignerProvider = toMicroEthSigner(model.wallet.value.ethereumClient)
		waitForDebtAmount(async () => await createContract(CETH_ABI, microEthSignerProvider, addressBigintToHex(CETH)).borrowBalanceCurrent.call(addressBigintToHex(model.borrower.peek())))
	}
	useSignalEffect(refresh)
	useSignalEffect(() => { model.debtInAttoeth.value === undefined && refresh() })
	useSignalEffect(() => { model.debtInAttoeth.deepValue = debtAmount.value.state === 'resolved' ? debtAmount.value.value : undefined })
	useSignalEffect(() => { debtAmount.value.state === 'rejected' && model.noticeError(debtAmount.value.error) })
	const [Refresh_] = useState(() => () => <Refresh onClick={refresh}/>)
	switch (debtAmount.value.state) {
		case 'inactive': return <Refresh_/>
		case 'pending': return <Spinner/>
		case 'rejected': return <Refresh_/>
		case 'resolved': return <span>{bigintToDecimalString(debtAmount.value.value, 18n)} <Refresh_/></span>
	}
}

type PayDebtButtonModel = {
	readonly wallet: Signal<Wallet>
	readonly debtorAddress: ReadonlySignal<bigint>
	readonly amountToRepay: ReadonlySignal<bigint>
	readonly noticeError: (error: unknown) => void
	readonly sendComplete: () => void
}
function PayDebtButton(model: PayDebtButtonModel) {
	const { value: sendResult, waitFor: waitForSend } = useAsyncState()
	useSignalEffect(() => { sendResult.value.state === 'rejected' && model.noticeError(sendResult.value.error) })
	useSignalEffect(() => { sendResult.value.state === 'resolved' && model.sendComplete() })
	function submit() {
		waitForSend(async () => {
			if (model.wallet.value.readonly) throw new Error(`The selected wallet cannot send transactions.`)
			const microWeb3Provider = toMicroEthSigner(model.wallet.value.ethereumClient)
			await (await model.wallet.value.ethereumClient.sendTransaction({
				to: CETH_REPAY_HELPER,
				value: model.amountToRepay.value,
				data: createContract(CETH_REPAY_HELPER_ABI, microWeb3Provider, addressBigintToHex(CETH_REPAY_HELPER)).repayBehalfExplicit.encodeInput({ borrower: addressBigintToHex(model.debtorAddress.value), cEther_: addressBigintToHex(CETH) }),
			})).waitForReceipt()
		})
	}
	return sendResult.value.state === 'pending'
		? <Spinner/>
		: <button onClick={submit} disabled={model.wallet.value.readonly || model.debtorAddress.value === undefined || model.amountToRepay.value === undefined}>Submit</button>
}
