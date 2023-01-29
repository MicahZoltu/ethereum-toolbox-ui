import { Signal, useSignal } from "@preact/signals";
import { JSX } from "preact/jsx-runtime";
import { Provider } from "../library/ethereum.js";
import { useAsyncState } from "../library/preact-utilities.js";
import { AutosizingInput } from "./AutosizingInput.js";
import { Spinner } from "./Spinner.js";

export interface RpcChooserModel {
	readonly provider: Signal<Provider | undefined>
	readonly style?: JSX.CSSProperties
}
export function RpcChooser(model: RpcChooserModel) {
	const [ url, checkUrlValidity, resetValidity ] = useAsyncState<string>()
	const internalValue = useSignal('')
	function testUrl() {
		checkUrlValidity(async () => {
			const url = internalValue.value || 'http://localhost:8545'
			if (!url.startsWith('http://') && !url.startsWith('https://')) throw new Error(`JSON-RPC URL must start with http:// or https://\n${url}`)
			const response = await fetch(url, { method: 'POST', body: '{ "jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[] }' })
			if (!response.ok) throw new Error(`${url} did not respond to Block Number request with an OK status code.`)
			const json = await response.json() as unknown
			if (typeof json !== 'object'
				|| json === null
				|| Array.isArray(json)
				|| !('result' in json)
				|| typeof json.result !== 'string'
				|| !json.result.startsWith('0x')
			) throw new Error(`Unexpected result from server: ${await response.text()}`)
			model.provider.value = await Provider.create(url)
			return url
		})
	}
	function InnerFragment() {
		switch (url.state) {
			case 'inactive': return <>
					<label>
						Ethereum JSON-RPC Server&thinsp;
						<AutosizingInput type='url' placeholder='http://localhost:8545' value={internalValue} dataList={['http://localhost:8545']} onInput={event => internalValue.value = event.currentTarget.value} style={{ border: '1px dotted', paddingInline: '5px' }}/>
					</label>
					&thinsp;
					<button onClick={testUrl}>Test</button>
				</>
			case 'pending': return <>Testing {internalValue.value || 'http://localhost:8545'}... <Spinner/></>
			case 'rejected': return <>{internalValue.value || 'http://localhost:8545'} is not a valid Ethereum JSON-RPC server. <span style={{ color: 'red' }}>{url.error.message}</span><button onClick={resetValidity}>Change</button></>
			case 'resolved': return <>{url.value} <button onClick={resetValidity}>Change</button></>
		}
	}
	return <div style={{ height: '22px', ...model.style }}><InnerFragment/></div>
}
