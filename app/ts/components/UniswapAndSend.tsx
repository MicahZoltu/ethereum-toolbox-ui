import { JSX } from 'preact/jsx-runtime'
import { ReadonlySignal, useSignal } from '@preact/signals'
import { addressBigintToHex, hexToBigint } from '@zoltu/ethereum-transactions/converters.js'
import { contract } from 'micro-web3'
import * as Uniswap3 from 'micro-web3/api/uniswap-v3.js'
import { ERC20, UNISWAP_V3_ROUTER_CONTRACT } from 'micro-web3/contracts/index.js'
import { TOKENS, tokensByName } from '../library/tokens.js'
import { TokenAndAmount } from './TokenAndAmount.js'
import { AddressPicker } from './AddressPicker.js'
import { toMicroWeb3, Wallet } from '../library/ethereum.js'
import { useAsyncState, useOptionalSignal } from '../library/preact-utilities.js'
import { Spinner } from './Spinner.js'
import { ResolvePromise } from '../library/typescript.js'
import { useState } from 'preact/hooks'

export type UniswapAndSendModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly style?: JSX.CSSProperties
}
export function UniswapAndSend(model: UniswapAndSendModel) {
	const microWeb3Provider = toMicroWeb3(model.wallet.value.ethereumClient)

	const sourceTokenSignal = useSignal<TOKENS>('ETH')
	const sourceAmount = useSignal<bigint>(0n)
	const { value: sourceAmountResult, waitFor: querySourceAmount, reset: _resetSourceAmount } = useAsyncState()
	const recipient = useOptionalSignal<bigint>(undefined)
	const targetTokenSignal = useSignal<TOKENS>('USDC')
	const targetAmount = useSignal<bigint>(0n)
	const { value: targetAmountResult, waitFor: queryTargetAmount, reset: _resetTargetAmount } = useAsyncState()
	const userSpecifiedValue = useSignal<'source' | 'target'>('source')
	const route = useOptionalSignal<ResolvePromise<ReturnType<typeof Uniswap3.bestPath>>>(undefined)
	const { value: sendResult, waitFor: waitForSend, reset: _resetSend } = useAsyncState()

	const sourceAmountChanged = () => {
		userSpecifiedValue.value = 'source'
		if (sourceAmount.peek() === 0n) return
		queryTargetAmount(async function () {
			try {
				const sourceToken = sourceTokenSignal.peek()
				const source = sourceToken === 'ETH' ? 'eth' : tokensByName[sourceToken].address
				const targetToken = targetTokenSignal.peek()
				const target = targetToken === 'ETH' ? 'eth' : tokensByName[targetToken].address
				route.deepValue = await Uniswap3.bestPath(microWeb3Provider, source, target, sourceAmount.peek(), undefined)
				// set to source again here in case there is a race where the user manages to touch the target before this resolves
				userSpecifiedValue.value = 'source'
				const amountOut = route.deepPeek()?.amountOut
				if (amountOut) targetAmount.value = amountOut
			} catch (error) {
				console.error(error)
			}
		})
	}

	const targetAmountChanged = () => {
		userSpecifiedValue.value = 'target'
		if (targetAmount.peek() === 0n) return
		querySourceAmount(async function () {
			try {
				const sourceToken = sourceTokenSignal.peek()
				const source = sourceToken === 'ETH' ? 'eth' : tokensByName[sourceToken].address
				const targetToken = targetTokenSignal.peek()
				const target = targetToken === 'ETH' ? 'eth' : tokensByName[targetToken].address
				route.deepValue = await Uniswap3.bestPath(microWeb3Provider, source, target, undefined, targetAmount.peek())
				// set to source again here in case there is a race where the user manages to touch the source before this resolves
				userSpecifiedValue.value = 'target'
				const amountIn = route.deepPeek()?.amountIn
				if (amountIn) sourceAmount.value = amountIn
			} catch (error) {
				console.error(error)
			}
		})
	}

	// when either token changes, update the 'output' amount
	const tokenChanged = () => (userSpecifiedValue.value === 'source') ? sourceAmountChanged() : targetAmountChanged()

	const [SourceToken_] = useState(() => () => (sourceAmountResult.value.state === 'pending') ? <Spinner/> : <TokenAndAmount key='source' token={sourceTokenSignal} amount={sourceAmount} onAmountChange={sourceAmountChanged} onTokenChange={tokenChanged}/>)
	const [TargetToken_] = useState(() => () => (targetAmountResult.value.state === 'pending') ? <Spinner/> : <TokenAndAmount key='target' token={targetTokenSignal} amount={targetAmount} onAmountChange={targetAmountChanged} onTokenChange={tokenChanged}/>)

	const [SubmitButton_] = useState(() => () => {
		// FIXME: if recipient is changed/cleared (but not valid) the send button remains accessible and will send to last known good recipient
		if (model.wallet.value.readonly || route.value === undefined || recipient.value === undefined) {
			return <button disabled>Send</button>
		}
		const onClick = () => waitForSend(async () => {
			const wallet = model.wallet
			if (wallet.value.readonly) return
			if (route.deepValue === undefined) return
			if (recipient.deepValue === undefined) return
			const sourceToken = sourceTokenSignal.peek()
			const source = sourceToken === 'ETH' ? 'eth' : tokensByName[sourceToken].address
			const targetToken = targetTokenSignal.peek()
			const target = targetToken === 'ETH' ? 'eth' : tokensByName[targetToken].address
			const swapTransactionDetails = Uniswap3.txData(addressBigintToHex(recipient.deepValue), source, target, route.deepValue, userSpecifiedValue.value === 'source' ? sourceAmount.value : undefined, userSpecifiedValue.value === 'target' ? targetAmount.value : undefined, { slippagePercent: 0.05, ttl: 60*60 })
			if ('allowance' in swapTransactionDetails && swapTransactionDetails.allowance !== undefined) {
				const allowance = await contract(ERC20, microWeb3Provider, swapTransactionDetails.allowance.token).allowance.call({ owner: addressBigintToHex(wallet.value.address), spender: UNISWAP_V3_ROUTER_CONTRACT })
				if (allowance < swapTransactionDetails.allowance.amount) {
					await wallet.value.sendTransaction({
						to: hexToBigint(swapTransactionDetails.allowance.token),
						value: 0n,
						data: contract(ERC20, microWeb3Provider, swapTransactionDetails.allowance.token).approve.encodeInput({ spender: UNISWAP_V3_ROUTER_CONTRACT, value: swapTransactionDetails.allowance.amount - allowance }),
					})
				}
			}
			await wallet.value.sendTransaction({
				to: hexToBigint(swapTransactionDetails.to),
				value: swapTransactionDetails.value,
				// cast necessary until https://github.com/paulmillr/micro-web3/issues/4 is fixed
				data: swapTransactionDetails.data as Uint8Array,
			})
		})
		return sendResult.value.state === 'pending'
			? <Spinner/>
			: <button onClick={onClick} disabled={model.wallet.value.readonly}>Send</button>
	})

	const [Recipient_] = useState(() => () => <AddressPicker required address={recipient} extraOptions={[model.wallet.value.address]}/>)
	const [Refresh_] = useState(() => () => {
		const onClick = () => {
			if (userSpecifiedValue.value === 'source') {
				sourceAmountChanged()
			} else {
				targetAmountChanged()
			}
		}
		return sourceAmount.value === 0n && targetAmount.value === 0n ? <></> : <button onClick={onClick}>↻</button>
	})

	return <div style={model.style}>
		<div>Send <SourceToken_/> to <Recipient_/> as <TargetToken_/> <Refresh_/> <SubmitButton_/></div>
		<div style={{ color: 'red' }}>{sendResult.value.state === 'rejected' && sendResult.value.error.message}</div>
	</div>
}
