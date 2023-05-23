import { ReadonlySignal } from '@preact/signals'
import { Wallet } from '../library/ethereum.js'
import { useOptionalSignal } from '../library/preact-utilities.js'
import { Balances } from './Balances.js'
import { CompoundBorrow } from './CompoundBorrow.js'
import { CompoundRepay } from './CompoundRepay.js'
import { UniswapAndSend } from './UniswapAndSend.js'
import { WalletChooser } from './WalletChooser.js'

export interface AppModel {
}

export function App(_model: AppModel) {
	const maybeWallet = useOptionalSignal<Wallet>(undefined)
	return <main>
		<WalletChooser wallet={maybeWallet} class='widget'/>
		{maybeWallet.value && <Apps wallet={maybeWallet.value}/>}
	</main>
}

export function Apps(model: {wallet: ReadonlySignal<Wallet>}) {
	return <>
		<Balances wallet={model.wallet} class='widget'/>
		<UniswapAndSend wallet={model.wallet} class='widget'/>
		<CompoundBorrow wallet={model.wallet} class='widget'/>
		<CompoundRepay wallet={model.wallet} class='widget'/>
	</>
}
