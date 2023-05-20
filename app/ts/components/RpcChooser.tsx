import { useSignal } from "@preact/signals";
import { JSX } from "preact/jsx-runtime";
import { EthereumClientJsonRpc, IEthereumClient } from "../library/ethereum.js";
import { OptionalSignal, useAsyncState } from "../library/preact-utilities.js";
import { AutosizingInput } from "./AutosizingInput.js";
import { Spinner } from "./Spinner.js";
import { useState } from "preact/hooks";

export interface RpcChooserModel {
	readonly ethereumClient: OptionalSignal<IEthereumClient>
	readonly style?: JSX.CSSProperties
}
export function RpcChooser(model: RpcChooserModel) {
	const { value: url, waitFor: urlWaitFor, reset: resetValidity } = useAsyncState<string>()
	const existingProvider = model.ethereumClient.deepPeek()

	// try to use the existing provider's endpoint (if it exists)
	if (existingProvider && 'endpoint' in existingProvider && typeof existingProvider.endpoint === 'string') {
		urlWaitFor(async () => existingProvider.endpoint as string)
	}
	const internalValue = useSignal((existingProvider as {endpoint: string} | undefined)?.endpoint || '')
	function testUrl() {
		urlWaitFor(async () => {
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
			model.ethereumClient.deepValue = await EthereumClientJsonRpc.create(url)
			return url
		})
	}
	const [InnerFragment] = useState(() => () => {
		switch (url.value.state) {
			case 'inactive': return <>
					<label>
						Ethereum JSON-RPC Server&thinsp;
						<AutosizingInput type='url' placeholder='http://localhost:8545' value={internalValue} dataList={['http://localhost:8545', 'https://ethereum.zoltu.io', 'https://api.securerpc.com/v1']} style={{ paddingInline: '5px' }}/>
					</label>
					&thinsp;
					<button onClick={testUrl}>Test</button>
				</>
			case 'pending': return <>Testing {internalValue.value || 'http://localhost:8545'}... <Spinner/></>
			case 'rejected': return <>{internalValue.value || 'http://localhost:8545'} is not a valid Ethereum JSON-RPC server. <span style={{ color: 'red' }}>{url.value.error.message}</span><button onClick={resetValidity}>Change</button></>
			case 'resolved': return <>{url.value.value} <button onClick={resetValidity}>Change</button></>
		}
	})
	return <div style={{ height: '22px', ...model.style }}><InnerFragment/></div>
}
