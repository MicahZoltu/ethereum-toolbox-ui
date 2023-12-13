import { ReadonlySignal, Signal, batch, useSignal, useSignalEffect } from '@preact/signals'
import { addressBigintToHex, bigintToHex } from '@zoltu/ethereum-transactions/converters.js'
import { contract } from 'micro-web3'
import { ERC20, WETH, WETH_CONTRACT } from 'micro-web3/contracts/index.js'
import { useState } from 'preact/hooks'
import { JSX } from 'preact/jsx-runtime'
import { savedWallets } from '../library/addresses.js'
import { QUOTER_ABI, ROUTER_ABI, UNISWAP_QUOTER_ADDRESS, UNISWAP_ROUTER_ADDRESS } from '../library/contract-details.js'
import { Wallet, toMicroWeb3 } from '../library/ethereum.js'
import { OptionalSignal, useAsyncState, useOptionalSignal } from '../library/preact-utilities.js'
import { AssetDetails, ETH_DETAILS, WETH_DETAILS } from '../library/tokens.js'
import { ResolvePromise } from '../library/typescript.js'
import { errorAsString } from '../library/utilities.js'
import { EthTransactionReceiptResult } from '../library/wire-types.js'
import { AddressPicker } from './AddressPicker.js'
import { Refresh } from './Refresh.js'
import { Spacer } from './Spacer.js'
import { Spinner } from './Spinner.js'
import { TokenAndAmount } from './TokenAndAmount.js'

type Route = { userSpecifiedValue: 'source' | 'target', source: AssetDetails, target: AssetDetails, amountIn: bigint, amountOut: bigint, fee: bigint }

export type SwapAndSendModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly noticeError: (error: unknown) => unknown
	readonly style?: JSX.CSSProperties
	readonly class?: JSX.HTMLAttributes['class']
}
export function SwapAndSend(model: SwapAndSendModel) {
	const microWeb3Provider = toMicroWeb3(model.wallet.value.ethereumClient)

	const sourceTokenSignal = useSignal<AssetDetails>(ETH_DETAILS)
	const sourceAmount = useOptionalSignal<bigint>(undefined)
	const { value: sourceAmountResult, waitFor: querySourceAmount, reset: _resetSourceAmount } = useAsyncState()
	const recipient = useOptionalSignal<bigint>(undefined)
	const targetTokenSignal = useSignal<AssetDetails>(ETH_DETAILS)
	const targetAmount = useOptionalSignal<bigint>(undefined)
	const { value: targetAmountResult, waitFor: queryTargetAmount, reset: _resetTargetAmount } = useAsyncState()
	const userSpecifiedValue = useOptionalSignal<'source' | 'target'>(undefined)
	const route = useOptionalSignal<Route>(undefined)
	const error = useOptionalSignal<string>(undefined)

	const sourceAmountChanged = () => {
		error.clear()
		targetAmount.clear()
		userSpecifiedValue.deepValue = 'source'
		const amountIn = sourceAmount.deepPeek()
		if (amountIn === undefined) {
			route.clear()
			return
		}
		queryTargetAmount(async function () {
			try {
				const source = sourceTokenSignal.peek()
				const tokenIn = getTokenOrWethAddressString(source)
				const target = targetTokenSignal.peek()
				const tokenOut = getTokenOrWethAddressString(target)

				const transferOrWrap = () => {
					return { amountOut: amountIn, fee: 0n }
				}
				const swapAndSend = async () => {
					const quoteExactInputSingle = contract(QUOTER_ABI, microWeb3Provider, addressBigintToHex(UNISWAP_QUOTER_ADDRESS)).quoteExactInputSingle.call
					const arrayOfObjectsWithPromises = [
						{ promise: quoteExactInputSingle({ tokenIn, tokenOut, fee: 500n, amountIn, sqrtPriceLimitX96: 0n }), fee: 500n },
						{ promise: quoteExactInputSingle({ tokenIn, tokenOut, fee: 3000n, amountIn, sqrtPriceLimitX96: 0n }), fee: 3000n },
						{ promise: quoteExactInputSingle({ tokenIn, tokenOut, fee: 10000n, amountIn, sqrtPriceLimitX96: 0n }), fee: 10000n },
					]
					const arrayOfPromises = arrayOfObjectsWithPromises.map(async x => ({ amountOut: (await x.promise).amountOut * 9990n / 10000n, fee: x.fee }))
					const arrayOfResults = await Promise.all(arrayOfPromises)
					return arrayOfResults.sort((a, b) => Number(b.amountOut - a.amountOut))[0]!
				}

				const { amountOut, fee } = (source === target || (source.symbol === 'ETH' && target.symbol === 'WETH') || (source.symbol === 'WETH' && target.symbol === 'ETH'))
					? transferOrWrap()
					: await swapAndSend()

				batch(() => {
					// set to source again here in case there is a race where the user manages to touch the target before this resolves
					userSpecifiedValue.deepValue = 'source'
					route.deepValue = { userSpecifiedValue: 'source', source, target, amountIn, amountOut, fee }
					// we set both here because we want to make sure the UI stays in sync at all times
					sourceAmount.deepValue = amountIn
					targetAmount.deepValue = amountOut
				})
			} catch (caught) {
				error.deepValue = errorAsString(caught)
				targetAmount.clear()
				route.clear()
			}
		})
	}

	const targetAmountChanged = () => {
		error.clear()
		sourceAmount.clear()
		userSpecifiedValue.deepValue = 'target'
		const amountOut = targetAmount.deepPeek()
		if (amountOut === undefined) {
			route.clear()
			return
		}
		querySourceAmount(async function () {
			try {
				const source = sourceTokenSignal.peek()
				const tokenIn = getTokenOrWethAddressString(source)
				const target = targetTokenSignal.peek()
				const tokenOut = getTokenOrWethAddressString(target)
				
				const transferOrWrap = () => ({ amountIn: amountOut, fee: 0n })
				const swapAndSend = async () => {
					const quoteExactOutputSingle = contract(QUOTER_ABI, microWeb3Provider, addressBigintToHex(UNISWAP_QUOTER_ADDRESS)).quoteExactOutputSingle.call
					const arrayOfObjectsWithPromises = [
						{ promise: quoteExactOutputSingle({ tokenIn, tokenOut, fee: 500n, amount: amountOut, sqrtPriceLimitX96: 0n }), fee: 500n },
						{ promise: quoteExactOutputSingle({ tokenIn, tokenOut, fee: 3000n, amount: amountOut, sqrtPriceLimitX96: 0n }), fee: 3000n },
						{ promise: quoteExactOutputSingle({ tokenIn, tokenOut, fee: 10000n, amount: amountOut, sqrtPriceLimitX96: 0n }), fee: 10000n },
					]
					const arrayOfPromises = arrayOfObjectsWithPromises.map(async x => ({ amountIn: (await x.promise).amountIn * 10010n / 10000n, fee: x.fee }))
					const arrayOfResults = await Promise.all(arrayOfPromises)
					return arrayOfResults.sort((a, b) => Number(a.amountIn - b.amountIn))[0]!
				}
				const { amountIn, fee } = (source === target || (source.symbol === 'ETH' && target.symbol === 'WETH') || (source.symbol === 'WETH' && target.symbol === 'ETH'))
					? transferOrWrap()
					: await swapAndSend()

				batch(() => {
					// set to source again here in case there is a race where the user manages to touch the target before this resolves
					userSpecifiedValue.deepValue = 'target'
					route.deepValue = { userSpecifiedValue: 'target', source, target, amountIn, amountOut, fee }
					// we set both here because we want to make sure the UI stays in sync at this point, since the submit button will become active here
					sourceAmount.deepValue = amountIn
					targetAmount.deepValue = amountOut
				})
			} catch (caught) {
				error.deepValue = errorAsString(caught)
				sourceAmount.clear()
				route.clear()
			}
		})
	}

	const [SourceToken_] = useState(() => () => {
		if (sourceAmountResult.value.state === 'pending') return <Spinner/>
		const [Refresh_] = useState(() => () => userSpecifiedValue.deepValue === 'target' && sourceAmount.value !== undefined && targetAmount.value !== undefined ? <Refresh onClick={targetAmountChanged}/> : <></>)
		const [TokenAndAmount_] = useState(() => () => <TokenAndAmount key='source' assetDetails={sourceTokenSignal} amount={sourceAmount} onAmountChange={sourceAmountChanged} onTokenChange={() => userSpecifiedValue.deepPeek() === 'source' ? sourceAmountChanged() : targetAmountChanged()}/>)
		return <><Refresh_/><TokenAndAmount_/></>
	})
	const [TargetToken_] = useState(() => () => {
		if (targetAmountResult.value.state === 'pending') return <Spinner/>
		const [Refresh_] = useState(() => () => userSpecifiedValue.deepValue === 'source' && sourceAmount.value !== undefined && targetAmount.value !== undefined ? <Refresh onClick={sourceAmountChanged}/> : <></>)
		const [TokenAndAmount_] = useState(() => () => <TokenAndAmount key='target' assetDetails={targetTokenSignal} amount={targetAmount} onAmountChange={targetAmountChanged} onTokenChange={() => userSpecifiedValue.deepPeek() === 'target' ? targetAmountChanged() : sourceAmountChanged()}/>)
		return <><Refresh_/><TokenAndAmount_/></>
	})
	const [SwapButton_] = useState(() => () => <SwapButton wallet={model.wallet} route={route} recipient={recipient} userSpecifiedValue={userSpecifiedValue} sourceToken={sourceTokenSignal} targetToken={targetTokenSignal} sourceAmount={sourceAmount} targetAmount={targetAmount} noticeError={model.noticeError}/>)
	const [Recipient_] = useState(() => () => <AddressPicker required address={recipient} extraOptions={[model.wallet.value.address, ...savedWallets.value]}/>)
	return <div style={model.style} class={model.class}>
		<div>Send <SourceToken_/> to <Recipient_/> as <TargetToken_/><Spacer/><SwapButton_/></div>
		{error.value !== undefined && <div style={{ color: 'red' }}>{error.value}</div>}
	</div>
}

type SwapButtonModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly route: OptionalSignal<Route>
	readonly recipient: OptionalSignal<bigint>
	readonly userSpecifiedValue: OptionalSignal<'source' | 'target'>
	readonly sourceToken: Signal<AssetDetails>
	readonly targetToken: Signal<AssetDetails>
	readonly sourceAmount: OptionalSignal<bigint>
	readonly targetAmount: OptionalSignal<bigint>
	readonly noticeError: (error: unknown) => unknown
}
function SwapButton(model: SwapButtonModel) {
	if (model.wallet.value.readonly) return <></>
	const [DisabledSwapButton_] = useState(() => ({red}:{red?: boolean}) => <button disabled style={red ? { color: 'red' } : {}}>Swap</button>)
	if (model.route.deepValue === undefined) return <DisabledSwapButton_/>
	if (model.recipient.deepValue === undefined) return <DisabledSwapButton_/>
	// verify that the current UI state exactly matches the route we have, it should but it would be very bad if it didn't
	if (model.sourceAmount.deepValue !== model.route.deepValue.amountIn) return <DisabledSwapButton_ red/>
	if (model.targetAmount.deepValue !== model.route.deepValue.amountOut) return <DisabledSwapButton_ red/>
	if (model.sourceToken.value !== model.route.deepValue.source) return <DisabledSwapButton_ red/>
	if (model.targetToken.value !== model.route.deepValue.target) return <DisabledSwapButton_ red/>
	if (model.userSpecifiedValue.deepValue !== model.route.deepValue.userSpecifiedValue) return <DisabledSwapButton_ red/>

	const { value: sendResult, waitFor: waitForSend, reset: _resetSend } = useAsyncState<EthTransactionReceiptResult>()
	// propogate errors up the chain for rendering in some error rendering system
	useSignalEffect(() => { sendResult.value.state === 'rejected' && model.noticeError(sendResult.value.error) })

	const onClick = () => {
		waitForSend(async () => {
			// in an abundance of caution, validate UI matches route once again and capture variables so nothing can change out from under us mid-processing
			const wallet = model.wallet.value
			const route = model.route.deepValue
			const recipient = model.recipient.deepValue
			if (wallet.readonly) throw new Error(`Readonly wallet.`)
			if (route === undefined) throw new Error(`Undefined route.`)
			if (recipient === undefined) throw new Error(`Undefined recipient.`)
			if (model.sourceAmount.deepValue !== route.amountIn) throw new Error(`Route amountIn doesn't match sourceAmount.`)
			if (model.targetAmount.deepValue !== route.amountOut) throw new Error(`Route amountOut doesn't match targetAmount.`)
			if (model.sourceToken.value !== route.source) throw new Error(`Route source doesn't match sourceToken.`)
			if (model.targetToken.value !== route.target) throw new Error(`Route target doesn't match targetToken.`)
			if (model.userSpecifiedValue.deepValue !== route.userSpecifiedValue) throw new Error(`Route userSpecifiedValue doesn't match userSpecifiedValue.`)
	
			const deadline = BigInt(Math.round(Date.now() / 1000)) + 10n ** 60n
			const amountIn = route.amountIn
			const amountOut = route.amountOut
			const fee = route.fee
			const recipientString = addressBigintToHex(recipient)

			const microWeb3Provider = toMicroWeb3(model.wallet.value.ethereumClient)
			const router = contract(ROUTER_ABI, microWeb3Provider, addressBigintToHex(UNISWAP_ROUTER_ADDRESS))
			const weth = contract(WETH, microWeb3Provider, WETH_CONTRACT)
			let sendTransactionResult: ResolvePromise<ReturnType<typeof wallet.ethereumClient.sendTransaction>>
			if (route.source.symbol === 'ETH' && route.target.symbol === 'ETH') {
				// special case for simple ETH transfers
				sendTransactionResult = await wallet.ethereumClient.sendTransaction({
					to: recipient,
					value: route.amountIn,
					data: new Uint8Array(0),
				})
			} else if (route.source === route.target && typeof route.source.address === 'bigint') {
				// special case for simple token transfers
				const tokenAddress = route.source.address
				const token = contract(ERC20, microWeb3Provider, addressBigintToHex(tokenAddress))
				sendTransactionResult = await wallet.ethereumClient.sendTransaction({
					to: tokenAddress,
					value: 0n,
					data: token.transfer.encodeInput({ to: addressBigintToHex(recipient), value: route.amountIn }),
				})
			} else if (route.source.symbol === 'ETH' && route.target.symbol === 'WETH') {
				// special case for wrapping WETH
				sendTransactionResult = await wallet.ethereumClient.sendTransaction({
					to: WETH_DETAILS.address,
					value: route.amountIn,
					data: weth.deposit.encodeInput({}),
				})
			} else if (route.source.symbol === 'WETH' && route.target.symbol === 'ETH') {
				// special case for unwrapping ETH
				sendTransactionResult = await wallet.ethereumClient.sendTransaction({
					to: WETH_DETAILS.address,
					value: 0n,
					data: weth.withdraw.encodeInput(route.amountIn)
				})
			} else {
				// swap and send
				const tokenIn = getTokenOrWethAddressString(route.source)
				const tokenOut = getTokenOrWethAddressString(route.target)
				const transactions = [
					route.userSpecifiedValue === 'source'
						? router.exactInputSingle.encodeInput({ tokenIn, tokenOut, amountIn, amountOutMinimum: amountOut, fee, recipient: recipientString, sqrtPriceLimitX96: 0n })
						: router.exactOutputSingle.encodeInput({ tokenIn, tokenOut, amountInMaximum: amountIn, amountOut, fee, recipient: recipientString, sqrtPriceLimitX96: 0n }),
					// TODO: figure out under what conditions each of these are actually necessary
					router.sweepToken.encodeInput({ token: tokenIn, amountMinimum: 0n, recipient: recipientString }),
					router.sweepToken.encodeInput({ token: tokenOut, amountMinimum: 0n, recipient: recipientString }),
					router.unwrapWETH9.encodeInput({amountMinimum: 0n, recipient: recipientString}),
					router.refundETH.encodeInput({}),
				]
				const transaction = router.multicall.encodeInput({ deadline, data: transactions })
				sendTransactionResult = await wallet.ethereumClient.sendTransaction({
					to: UNISWAP_ROUTER_ADDRESS,
					value: route.source.symbol === 'ETH' ? route.amountIn : 0n,
					data: transaction,
				})
			}
			const receipt = await sendTransactionResult.waitForReceipt()
			if (receipt === null) throw new Error(`No transactoin receipt found for transaction ${bigintToHex(sendTransactionResult.transactionHash)}.`)
			if (receipt.status === 'failure') throw new Error(`Transaction mined but reverted, no changes made.`)
			model.sourceAmount.clear()
			model.targetAmount.clear()
			model.recipient.clear()
			return receipt
		})
	}

	const [SwapButton_] = useState(() => () => {
		const text = model.recipient.deepValue === 0n
			? 'Burn'
			: model.sourceToken.value === model.targetToken.value
				? model.recipient.deepValue === model.wallet.value.address
					? 'Self Send'
					: 'Send'
				: model.sourceToken.value.symbol === 'ETH' && model.targetToken.value.symbol === 'WETH'
					? model.recipient.deepValue === model.wallet.value.address
						? 'Wrap'
						: 'Wrap and Send'
					: model.sourceToken.value.symbol === 'WETH' && model.targetToken.value.symbol === 'ETH'
						? model.recipient.deepValue === model.wallet.value.address
							? 'Unwap'
							: 'Unwrap and Send'
						: model.recipient.deepValue === model.wallet.value.address
							? 'Swap'
							: 'Swap and Send'
		const disabled = model.recipient.deepValue !== model.wallet.value.address && ((model.sourceToken.value.symbol === 'ETH' && model.targetToken.value.symbol === 'WETH') || (model.sourceToken.value.symbol === 'WETH' && model.targetToken.value.symbol === 'ETH'))
		return <button onClick={onClick} disabled={disabled}>{text}</button>
	})
	return sendResult.value.state === 'pending'
		? <Spinner/>
		: <SwapButton_/>
}

function getTokenOrWethAddressString(asset: AssetDetails): string {
	return addressBigintToHex(asset.symbol === 'ETH'
		? WETH_DETAILS.address
		: asset.address as bigint)
}
