import { ReadonlySignal } from "@preact/signals"
import { JSX } from "preact"
import { useState } from "preact/hooks"
import { Wallet } from "../library/ethereum.js"
import { useAsyncComputed } from "../library/preact-utilities.js"
import { Spinner } from "./Spinner.js"

export function AccountDetails(model: {
	readonly wallet: ReadonlySignal<Wallet>
	readonly noticeError: (error: unknown) => void
	readonly style?: JSX.CSSProperties
	readonly class?: JSX.HTMLAttributes['class']
}) {
	const [Nonce_] = useState(() => () => {
		const asyncNonce = useAsyncComputed<bigint>(async () => await model.wallet.value.ethereumClient.getTransactionCount(model.wallet.value.address, 'latest'), { onRejected: model.noticeError })
		switch (asyncNonce.value.state) {
			case 'pending': return <>Nonce: <Spinner/></>
			case 'rejected': return <>Nonce: ⚠️</>
			case 'resolved': return <>Nonce: {asyncNonce.value.value}</>
		}
	})
	return <div class={model.class} style={model.style}>
		<div><b><u>Account Details</u></b></div>
		<Nonce_/>
	</div>
}
