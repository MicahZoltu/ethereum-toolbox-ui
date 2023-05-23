import { useSignal, useSignalEffect } from "@preact/signals";
import { JSX } from "preact/jsx-runtime";
import { EthereumClientJsonRpc, IEthereumClient } from "../library/ethereum.js";
import { OptionalSignal, useAsyncState } from "../library/preact-utilities.js";
import { AutosizingInput } from "./AutosizingInput.js";
import { Spinner } from "./Spinner.js";
import { useState } from "preact/hooks";
import { Spacer } from "./Spacer.js";

export interface RpcChooserModel {
	readonly ethereumClient: OptionalSignal<IEthereumClient>
	readonly error: OptionalSignal<string>
	readonly class?: JSX.HTMLAttributes['class']
	readonly style?: JSX.CSSProperties
}
export function RpcChooser(model: RpcChooserModel) {
	const [RpcChooser_] = useState(() => () => {
		const { value: url, waitFor: urlWaitFor, reset: resetValidity } = useAsyncState<string>()
		const existingProvider = model.ethereumClient.deepPeek()

		useSignalEffect(() => { url.value.state === 'rejected' && (model.error.deepValue = `${internalValue.peek() || 'http://localhost:8545'} is not a valid Ethereum JSON-RPC server:\n${url.value.error.message}`) })

		// try to use the existing provider's endpoint (if it exists)
		if (existingProvider && 'endpoint' in existingProvider && typeof existingProvider.endpoint === 'string') {
			urlWaitFor(async () => existingProvider.endpoint as string)
		}
		const internalValue = useSignal((existingProvider as {endpoint: string} | undefined)?.endpoint || '')
		function testUrl() {
			urlWaitFor(async () => {
				model.error.clear()
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
		const [Change_] = useState(() => () => <button onClick={resetValidity}>Change</button>)
		const [RpcInput_] = useState(() => () => <AutosizingInput type='url' placeholder='http://localhost:8545' value={internalValue} dataList={['http://localhost:8545', 'https://ethereum.zoltu.io', 'https://api.securerpc.com/v1']}/>)
		const [TestButton_] = useState(() => () => <button onClick={testUrl}>Test</button>)
		switch (url.value.state) {
			case 'inactive':
			case 'rejected': return <><label>Ethereum JSON-RPC Server<RpcInput_/></label><Spacer/><TestButton_/></>
			case 'pending': return <>Testing {internalValue.value || 'http://localhost:8545'}...&ensp;<Spinner/></>
			case 'resolved': return <>{url.value.value}<Spacer/><Change_/></>
		}
	})
	return <div style={{...model.style, flexGrow: 1}} class={model.class} id='rpc-chooser'><RpcChooser_/></div>
}
