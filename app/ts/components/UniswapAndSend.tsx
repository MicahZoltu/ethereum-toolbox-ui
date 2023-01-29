import { JSX } from 'preact/jsx-runtime'
import { Signal, useSignal } from '@preact/signals'
import { bestPath, txData } from 'micro-web3/api/uniswap-v3'
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
	const [ sourceAmountResult, querySourceAmount, _resetSourceAmount ] = useAsyncState()
	const recipient = useSignal<string>('')
	const targetToken = useSignal<TOKENS>('WETH')
	const targetAmount = useSignal<bigint>(0n)
	const [ targetAmountResult, queryTargetAmount, _resetTargetAmount ] = useAsyncState()
	const userSpecifiedValue = useSignal<'source' | 'target'>('source')
	const lastCalculatedRoute = useSignal<ResolvePromise<ReturnType<typeof bestPath>> | undefined>(undefined)

	const sourceChanged = () => {
		userSpecifiedValue.value = 'source'
		if (sourceAmount.peek() === 0n) return
		// TODO: handle async errors
		queryTargetAmount(async function () {
			lastCalculatedRoute.value = await bestPath(microWeb3Provider, tokensByName[sourceToken.value].address, tokensByName[targetToken.value].address, sourceAmount.value, undefined)
			// set to source again here in case there is a race where the user manages to touch the target before this resolves
			userSpecifiedValue.value = 'source'
			if (lastCalculatedRoute.value.amountOut) targetAmount.value = lastCalculatedRoute.value.amountOut
		})
	}

	const targetChanged = () => {
		userSpecifiedValue.value = 'target'
		if (targetAmount.peek() === 0n) return
		// TODO: handle with async errors
		querySourceAmount(async function () {
			lastCalculatedRoute.value = await bestPath(microWeb3Provider, tokensByName[sourceToken.value].address, tokensByName[targetToken.value].address, undefined, targetAmount.value)
			// set to source again here in case there is a race where the user manages to touch the source before this resolves
			userSpecifiedValue.value = 'target'
			if (lastCalculatedRoute.value.amountIn) sourceAmount.value = lastCalculatedRoute.value.amountIn
		})
	}

	const SourceToken = (sourceAmountResult.state === 'pending') ? <Spinner/> : <TokenAndAmount key='source' token={sourceToken} amount={sourceAmount} onAmountChange={sourceChanged}/>
	const TargetToken = (targetAmountResult.state === 'pending') ? <Spinner/> : <TokenAndAmount key='target' token={targetToken} amount={targetAmount} onAmountChange={targetChanged}/>

	function SubmitButton() {
		const wallet = model.wallet.value
		if (wallet === undefined || lastCalculatedRoute.value === undefined) {
			return <button disabled>Send</button>
		}
		// TODO: deal with async exceptions, perhaps move this to AsyncState
		const onClick = async () => {
			if (lastCalculatedRoute.value === undefined) return
			// TODO: create the router swap transaction payload
			console.log(`Source Token: ${sourceToken}`)
			console.log(`Source Amount: ${sourceAmount}`)
			console.log(`Recipient: ${recipient}`)
			console.log(`Target Token: ${targetToken}`)
			console.log(`Target Amount: ${targetAmount}`)
			const swapTransactionDetails = txData(recipient.value, tokensByName[sourceToken.value].address, tokensByName[targetToken.value].address, lastCalculatedRoute.value, lastCalculatedRoute.value.amountIn, lastCalculatedRoute.value.amountOut, { slippagePercent: 0.05, ttl: 60*60 })
			console.log(JSON.stringify(swapTransactionDetails))
		}
		return <button onClick={onClick}>Send</button>
	}
	return <div style={model.style}>
		Send {SourceToken} to <AddressPicker address={recipient}/> as {TargetToken} <SubmitButton/>
	</div>
}
