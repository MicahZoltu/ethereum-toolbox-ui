import { JSX } from 'preact/jsx-runtime'
import { Signal, useSignal } from '@preact/signals'
import * as Uniswap3 from 'micro-web3/api/uniswap-v3.js'
import { TOKENS, tokensByName } from '../library/tokens.js'
import { TokenAndAmount } from './TokenAndAmount.js'
import { AddressPicker } from './AddressPicker.js'
import { Provider, toMicroWeb3, Wallet } from '../library/ethereum.js'
import { useAsyncState } from '../library/preact-utilities.js'
import { Spinner } from './Spinner.js'
import { ResolvePromise } from '../library/typescript.js'

// const quoter = fromChecksummedAddress('0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6')
// const swapRouter = fromChecksummedAddress('0xE592427A0AEce92De3Edee1F18E0157C05861564')

export interface UniswapAndSendModel {
	readonly wallet: Signal<Wallet | undefined>,
	readonly provider: Signal<Provider | undefined>,
	readonly style?: JSX.CSSProperties,
}
export function UniswapAndSend(model: UniswapAndSendModel) {
	const provider = model.provider.value
	if (provider === undefined) {
		return <div style={model.style}>You must select a provider before you can use Uniswap Swap &amp; Send</div>
	}
	const microWeb3Provider = toMicroWeb3(provider)

	const sourceToken = useSignal<TOKENS>('WETH')
	const sourceAmount = useSignal<bigint>(0n)
	const { value: sourceAmountResult, waitFor: querySourceAmount, reset: _resetSourceAmount } = useAsyncState()
	const recipient = useSignal<string>('')
	const targetToken = useSignal<TOKENS>('WETH')
	const targetAmount = useSignal<bigint>(0n)
	const { value: targetAmountResult, waitFor: queryTargetAmount, reset: _resetTargetAmount } = useAsyncState()
	const userSpecifiedValue = useSignal<'source' | 'target'>('source')
	const route = useSignal<ResolvePromise<ReturnType<typeof Uniswap3.bestPath>> | undefined>(undefined)

	const sourceAmountChanged = () => {
		userSpecifiedValue.value = 'source'
		if (sourceAmount.peek() === 0n) return
		// TODO: handle async errors
		queryTargetAmount(async function () {
			route.value = await Uniswap3.bestPath(microWeb3Provider, tokensByName[sourceToken.peek()].address, tokensByName[targetToken.peek()].address, sourceAmount.peek(), undefined)
			// set to source again here in case there is a race where the user manages to touch the target before this resolves
			userSpecifiedValue.value = 'source'
			const amountOut = route.peek()?.amountOut
			if (amountOut) targetAmount.value = amountOut
		})
	}

	const targetAmountChanged = () => {
		userSpecifiedValue.value = 'target'
		if (targetAmount.peek() === 0n) return
		// TODO: handle with async errors
		querySourceAmount(async function () {
			route.value = await Uniswap3.bestPath(microWeb3Provider, tokensByName[sourceToken.peek()].address, tokensByName[targetToken.peek()].address, undefined, targetAmount.peek())
			// set to source again here in case there is a race where the user manages to touch the source before this resolves
			userSpecifiedValue.value = 'target'
			const amountIn = route.peek()?.amountIn
			if (amountIn) sourceAmount.value = amountIn
		})
	}

	// when either token changes, update the 'output' amount
	const tokenChanged = () => (userSpecifiedValue.value === 'source') ? sourceAmountChanged() : targetAmountChanged()

	const SourceToken = (sourceAmountResult.value.state === 'pending') ? <Spinner/> : <TokenAndAmount key='source' token={sourceToken} amount={sourceAmount} onAmountChange={sourceAmountChanged} onTokenChange={tokenChanged}/>
	const TargetToken = (targetAmountResult.value.state === 'pending') ? <Spinner/> : <TokenAndAmount key='target' token={targetToken} amount={targetAmount} onAmountChange={targetAmountChanged} onTokenChange={tokenChanged}/>

	function SubmitButton() {
		const wallet = model.wallet.value
		if (wallet === undefined || route.value === undefined) {
			return <button disabled>Send</button>
		}
		const onClick = () => {
			if (route.value === undefined) return
			// TODO: create the router swap transaction payload
			console.log(`Source Token: ${sourceToken}`)
			console.log(`Source Amount: ${sourceAmount}`)
			console.log(`Recipient: ${recipient}`)
			console.log(`Target Token: ${targetToken}`)
			console.log(`Target Amount: ${targetAmount}`)
			const swapTransactionDetails = Uniswap3.txData(recipient.value, tokensByName[sourceToken.value].address, tokensByName[targetToken.value].address, route.value, route.value.amountIn, route.value.amountOut, { slippagePercent: 0.05, ttl: 60*60 })
			console.log(JSON.stringify(swapTransactionDetails))
		}
		return <button onClick={onClick}>Send</button>
	}
	return <div style={model.style}>
		Send {SourceToken} to <AddressPicker address={recipient}/> as {TargetToken} <SubmitButton/>
	</div>
}
