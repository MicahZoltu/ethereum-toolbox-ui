import { ReadonlySignal } from '@preact/signals'
import { useEffect, useState } from 'preact/hooks'
import { Wallet } from '../library/ethereum.js'
import { useOptionalSignal } from '../library/preact-utilities.js'
import { ensureError } from '../library/utilities.js'
import { AccountDetails } from './Account.js'
import { Balances } from './Balances.js'
import { CloseButton } from './CloseButton.js'
import { CompoundBorrow } from './CompoundBorrow.js'
import { CompoundRepay } from './CompoundRepay.js'
import { GnosisSafe } from './GnosisSafe.js'
import { SwapAndSend } from './SwapAndSend.js'
import { WalletChooser } from './WalletChooser.js'
import { DepositIntoVault, WithdrawFromVault } from './Yearn.js'

export interface AppModel {
}

export function App(_model: AppModel) {
	const maybeWallet = useOptionalSignal<Wallet>(undefined)
	const lastError = useOptionalSignal<Error>(undefined)
	useEffect(() => lastError.subscribe(x => { x !== undefined && console.error(x.value) }), [])
	const noticeError = (error: unknown) => lastError.deepValue = ensureError(error)
	const [Apps_] = useState(() => () => maybeWallet.value === undefined ? <></> : <Apps wallet={maybeWallet.value} noticeError={noticeError}/>)
	const [Error_] = useState(() => () => lastError.deepValue === undefined ? <></> : <div class='error-text'>{lastError.deepValue.message}<CloseButton onClick={() => lastError.clear()}/></div>)
	return <main>
		<div class='widget'>
			<h1>Wallet</h1>
			<WalletChooser wallet={maybeWallet} noticeError={noticeError}/>
		</div>
		<Apps_/>
		<Error_/>
	</main>
}

export function Apps(model: { wallet: ReadonlySignal<Wallet>, noticeError: (error: unknown) => void }) {
	return <>
		<AccountDetails wallet={model.wallet} noticeError={model.noticeError} class='widget'/>
		<Balances wallet={model.wallet} noticeError={model.noticeError} class='widget'/>
		<SwapAndSend wallet={model.wallet} noticeError={model.noticeError} class='widget'/>
		<div class='widget'>
			<h1>Compound</h1>
			<CompoundBorrow wallet={model.wallet} noticeError={model.noticeError} class='widget'/>
			<CompoundRepay wallet={model.wallet} noticeError={model.noticeError} class='widget'/>
		</div>
		<div class='widget'>
			<h1>Yearn</h1>
			<DepositIntoVault wallet={model.wallet} noticeError={model.noticeError} class='widget'/>
			<WithdrawFromVault wallet={model.wallet} noticeError={model.noticeError} class='widget'/>
		</div>
		<GnosisSafe wallet={model.wallet} noticeError={model.noticeError} class='widget'/>
	</>
}
