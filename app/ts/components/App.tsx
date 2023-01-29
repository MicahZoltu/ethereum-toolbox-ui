import { useSignal } from '@preact/signals'
import { UniswapAndSend } from './UniswapAndSend.js'
import { RpcChooser } from './RpcChooser.js'
import { WalletChooser } from './WalletChooser.js'
import { Provider, Wallet } from '../library/ethereum.js'

export interface AppModel {
}

export function App(_model: AppModel) {
	const wallet = useSignal<Wallet | undefined>(undefined)
	const provider = useSignal<Provider | undefined>(undefined)
	return <main>
		<RpcChooser provider={provider} style={{ margin: '5px' }}/>
		<WalletChooser wallet={wallet} style={{ margin: '5px' }}/>
		<UniswapAndSend wallet={wallet} provider={provider} style={{ margin: '5px' }}/>
	</main>
}
