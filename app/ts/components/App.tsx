import { ReadonlySignal } from '@preact/signals'
import { Wallet } from '../library/ethereum.js'
import { useOptionalSignal } from '../library/preact-utilities.js'
import { CompoundBorrow } from './CompoundBorrow.js'
import { CompoundRepay } from './CompoundRepay.js'
import { UniswapAndSend } from './UniswapAndSend.js'
import { WalletChooser } from './WalletChooser.js'

export interface AppModel {
}

export function App(_model: AppModel) {
	const maybeWallet = useOptionalSignal<Wallet>(undefined)
	return <main>
		<WalletChooser wallet={maybeWallet} style={{ margin: '5px' }}/>
		{maybeWallet.value && <Apps wallet={maybeWallet.value}/>}
	</main>
}

export function Apps(model: {wallet: ReadonlySignal<Wallet>}) {
	return <>
		<UniswapAndSend wallet={model.wallet} style={{ margin: '5px', padding: '5px', borderStyle: 'solid', borderWidth: '1px', borderColor: 'black' }}/>
		<CompoundBorrow wallet={model.wallet} style={{ margin: '5px', padding: '5px', borderStyle: 'solid', borderWidth: '1px', borderColor: 'black' }}/>
		<CompoundRepay wallet={model.wallet} style={{ margin: '5px', padding: '5px', borderStyle: 'solid', borderWidth: '1px', borderColor: 'black' }}/>
	</>
}
