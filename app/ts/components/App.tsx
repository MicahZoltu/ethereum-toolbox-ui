import { useSignal } from '@preact/signals'
import { UniswapAndSend } from './UniswapAndSend.js'
import { WalletChooser } from './WalletChooser.js'
import { Wallet } from '../library/ethereum.js'

export interface AppModel {
}

export function App(_model: AppModel) {
	const wallet = useSignal<Wallet | undefined>(undefined)
	return <main>
		<WalletChooser wallet={wallet} style={{ margin: '5px' }}/>
		{ wallet.value && <UniswapAndSend wallet={wallet.value} style={{ margin: '5px' }}/> }
	</main>
}
