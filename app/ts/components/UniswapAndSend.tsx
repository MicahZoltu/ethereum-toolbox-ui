import { JSX } from 'preact/jsx-runtime'
import { useSignal } from '@preact/signals'
import { addressBigintToHex, hexToBigint } from '@zoltu/ethereum-transactions/converters.js'
import { contract } from 'micro-web3'
import * as Uniswap3 from 'micro-web3/api/uniswap-v3.js'
import { ERC20, UNISWAP_V3_ROUTER_CONTRACT } from 'micro-web3/contracts/index.js'
import { TOKENS, tokensByName } from '../library/tokens.js'
import { TokenAndAmount } from './TokenAndAmount.js'
import { AddressPicker } from './AddressPicker.js'
import { toMicroWeb3, Wallet } from '../library/ethereum.js'
import { useAsyncState } from '../library/preact-utilities.js'
import { Spinner } from './Spinner.js'
import { ResolvePromise } from '../library/typescript.js'

export type UniswapAndSendModel = {
	readonly wallet: Wallet
	readonly style?: JSX.CSSProperties
}
export function UniswapAndSend(model: UniswapAndSendModel) {
	const microWeb3Provider = toMicroWeb3(model.wallet.ethereumClient)

	const sourceToken = useSignal<TOKENS>('WETH')
	const sourceAmount = useSignal<bigint>(0n)
	const { value: sourceAmountResult, waitFor: querySourceAmount, reset: _resetSourceAmount } = useAsyncState()
	const recipient = useSignal<bigint | undefined>(undefined)
	const targetToken = useSignal<TOKENS>('WETH')
	const targetAmount = useSignal<bigint>(0n)
	const { value: targetAmountResult, waitFor: queryTargetAmount, reset: _resetTargetAmount } = useAsyncState()
	const userSpecifiedValue = useSignal<'source' | 'target'>('source')
	const route = useSignal<ResolvePromise<ReturnType<typeof Uniswap3.bestPath>> | undefined>(undefined)
	const { value: sendResult, waitFor: waitForSend, reset: _resetSend } = useAsyncState()

	const sourceAmountChanged = () => {
		userSpecifiedValue.value = 'source'
		if (sourceAmount.peek() === 0n) return
		queryTargetAmount(async function () {
			try {
				route.value = await Uniswap3.bestPath(microWeb3Provider, tokensByName[sourceToken.peek()].address, tokensByName[targetToken.peek()].address, sourceAmount.peek(), undefined)
				// set to source again here in case there is a race where the user manages to touch the target before this resolves
				userSpecifiedValue.value = 'source'
				const amountOut = route.peek()?.amountOut
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
				route.value = await Uniswap3.bestPath(microWeb3Provider, tokensByName[sourceToken.peek()].address, tokensByName[targetToken.peek()].address, undefined, targetAmount.peek())
				// set to source again here in case there is a race where the user manages to touch the source before this resolves
				userSpecifiedValue.value = 'target'
				const amountIn = route.peek()?.amountIn
				if (amountIn) sourceAmount.value = amountIn
			} catch (error) {
				console.error(error)
			}
		})
	}

	// when either token changes, update the 'output' amount
	const tokenChanged = () => (userSpecifiedValue.value === 'source') ? sourceAmountChanged() : targetAmountChanged()

	const SourceToken = (sourceAmountResult.value.state === 'pending') ? <Spinner/> : <TokenAndAmount key='source' token={sourceToken} amount={sourceAmount} onAmountChange={sourceAmountChanged} onTokenChange={tokenChanged}/>
	const TargetToken = (targetAmountResult.value.state === 'pending') ? <Spinner/> : <TokenAndAmount key='target' token={targetToken} amount={targetAmount} onAmountChange={targetAmountChanged} onTokenChange={tokenChanged}/>

	function SubmitButton() {
		if (route.value === undefined) {
			return <button disabled>Send</button>
		}
		const onClick = () => waitForSend(async () => {
			const wallet = model.wallet
			if (wallet.readonly) return
			if (route.value === undefined) return
			if (recipient.value === undefined) return
			const swapTransactionDetails = Uniswap3.txData(addressBigintToHex(recipient.value), tokensByName[sourceToken.value].address, tokensByName[targetToken.value].address, route.value, userSpecifiedValue.value === 'source' ? sourceAmount.value : undefined, userSpecifiedValue.value === 'target' ? targetAmount.value : undefined, { slippagePercent: 0.05, ttl: 60*60 })
			if ('allowance' in swapTransactionDetails && swapTransactionDetails.allowance !== undefined) {
				const allowance = await contract(ERC20, microWeb3Provider, swapTransactionDetails.allowance.token).allowance.call({ owner: addressBigintToHex(wallet.address), spender: UNISWAP_V3_ROUTER_CONTRACT })
				if (allowance < swapTransactionDetails.allowance.amount) {
					await wallet.sendTransaction({
						to: hexToBigint(swapTransactionDetails.allowance.token),
						value: 0n,
						data: contract(ERC20, microWeb3Provider, swapTransactionDetails.allowance.token).approve.encodeInput({ spender: UNISWAP_V3_ROUTER_CONTRACT, value: swapTransactionDetails.allowance.amount - allowance }),
					})
				}
			}
			await wallet.sendTransaction({
				to: hexToBigint(swapTransactionDetails.to),
				value: swapTransactionDetails.value,
				// cast necessary until https://github.com/paulmillr/micro-web3/issues/4 is fixed
				data: swapTransactionDetails.data as Uint8Array,
			})
		})
		return <button onClick={onClick} disabled={model.wallet.readonly}>Send</button>
	}
	return <div style={model.style}>
		<div>Send {SourceToken} to <AddressPicker address={recipient} extraOptions={[model.wallet.address]}/> as {TargetToken} {sendResult.value.state === 'pending' ? <Spinner/> : <SubmitButton/>}</div>
		<div style={{ color: 'red' }}>{sendResult.value.state === 'rejected' && sendResult.value.error.message}</div>
	</div>
}
