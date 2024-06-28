import { ReadonlySignal, Signal, batch, useSignal } from '@preact/signals'
import { addressBigintToHex, bigintToHex } from '@zoltu/ethereum-transactions/converters.js'
import { contract } from 'micro-web3'
import { ERC20, WETH, WETH_CONTRACT } from 'micro-web3/contracts/index.js'
import { useState } from 'preact/hooks'
import { JSX } from 'preact/jsx-runtime'
import { savedWallets } from '../library/addresses.js'
import { ERC20_ABI, QUOTER_ABI, ROUTER_ABI, UNISWAP_QUOTER_ADDRESS, UNISWAP_ROUTER_ADDRESS } from '../library/contract-details.js'
import { Wallet, toMicroWeb3 } from '../library/ethereum.js'
import { OptionalSignal, useAsyncComputed, useAsyncState, useOptionalSignal } from '../library/preact-utilities.js'
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
const erc20 = contract(ERC20_ABI)

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
					const arrayOfPromises: Promise<{ amountOut: bigint, fee: bigint }>[] = arrayOfObjectsWithPromises.map(async x => ({ amountOut: (await x.promise).amountOut * 9990n / 10000n, fee: x.fee }))
					const arrayOfResults = (await Promise.allSettled(arrayOfPromises)).filter((x): x is PromiseFulfilledResult<{ amountOut: bigint, fee: bigint }> => x.status === 'fulfilled').map(x => x.value)
					// if `arrayOfResults` is empty, it means all of the promises rejected, so just await them all normally and one of them will throw
					if (arrayOfResults.length === 0) await Promise.all(arrayOfPromises)
					// we have a null assertion here because in the case of an empty array we'll throw on the line above
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
					const arrayOfPromises: Promise<{ amountIn: bigint, fee: bigint }>[] = arrayOfObjectsWithPromises.map(async x => ({ amountIn: (await x.promise).amountIn * 10010n / 10000n, fee: x.fee }))
					const arrayOfResults = (await Promise.allSettled(arrayOfPromises)).filter((x): x is PromiseFulfilledResult<{ amountIn: bigint, fee: bigint }> => x.status === 'fulfilled').map(x => x.value)
					// if `arrayOfResults` is empty, it means all of the promises rejected, so just await them all normally and one of them will throw
					if (arrayOfResults.length === 0) await Promise.all(arrayOfPromises)
					// we have a null assertion here because in the case of an empty array we'll throw on the line above
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
		<span>Send <SourceToken_/> to <Recipient_/> as <TargetToken_/><Spacer/><SwapButton_/></span>
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

	const { value: sendResult, waitFor: waitForSend, reset: _resetSend } = useAsyncState<EthTransactionReceiptResult>().onRejected(model.noticeError)
	const needsApproval = useAsyncComputed(async () => {
		if (model.route.deepValue === undefined) return false
		if (model.route.deepValue.source.symbol === 'ETH') return false
		const allowanceResult = await model.wallet.value.ethereumClient.call({
			to: getTokenOrWethAddress(model.sourceToken.value),
			data: erc20.allowance.encodeInput({ owner: addressBigintToHex(model.wallet.value.address), spender: addressBigintToHex(UNISWAP_ROUTER_ADDRESS) })
		}, 'latest')
		const allowance = erc20.allowance.decodeOutput(allowanceResult)
		if (allowance >= model.route.deepValue.amountIn) return false
		return true
	}, { onRejected: model.noticeError })

	const onClick = () => {
		waitForSend(async () => {
			// in an abundance of caution, validate UI matches route once again and capture variables so nothing can change out from under us mid-processing
			const wallet = model.wallet.value
			if (wallet.readonly) throw new Error(`Readonly wallet.`)
			if (model.route.deepValue === undefined) throw new Error(`Undefined route.`)
			if (model.recipient.deepValue === undefined) throw new Error(`Undefined recipient.`)
			if (model.sourceAmount.deepValue !== model.route.deepValue.amountIn) throw new Error(`Route amountIn doesn't match sourceAmount.`)
			if (model.targetAmount.deepValue !== model.route.deepValue.amountOut) throw new Error(`Route amountOut doesn't match targetAmount.`)
			if (model.sourceToken.value !== model.route.deepValue.source) throw new Error(`Route source doesn't match sourceToken.`)
			if (model.targetToken.value !== model.route.deepValue.target) throw new Error(`Route target doesn't match targetToken.`)
			if (model.userSpecifiedValue.deepValue !== model.route.deepValue.userSpecifiedValue) throw new Error(`Route userSpecifiedValue doesn't match userSpecifiedValue.`)
			if (needsApproval.value.state !== 'resolved') throw new Error(`Button clicked before approval needs discovered.`)

			const deadline = BigInt(Math.round(Date.now() / 1000)) + 10n ** 60n
			const amountIn = model.route.deepValue.amountIn
			const amountOut = model.route.deepValue.amountOut
			const fee = model.route.deepValue.fee
			const recipientString = addressBigintToHex(model.recipient.deepValue)

			const microWeb3Provider = toMicroWeb3(model.wallet.value.ethereumClient)
			const router = contract(ROUTER_ABI, microWeb3Provider, addressBigintToHex(UNISWAP_ROUTER_ADDRESS))
			const weth = contract(WETH, microWeb3Provider, WETH_CONTRACT)
			let sendTransactionResult: ResolvePromise<ReturnType<typeof wallet.ethereumClient.sendTransaction>>
			if (model.route.deepValue.source.symbol === 'ETH' && model.route.deepValue.target.symbol === 'ETH') {
				if (model.route.deepValue.amountIn === await wallet.ethereumClient.getBalance(wallet.address, 'latest')) {
					// special case for sweeping
					const baseFee = await wallet.ethereumClient.getBaseFee('latest')
					const maxFeePerGas = baseFee * 2n
					const transaction = {
						to: model.recipient.deepValue,
						value: 1n, // smallest amount possible for gas estimation (hopefully results don't differ by amount)
						data: new Uint8Array(0),
					} as const
					const gasLimit = await wallet.ethereumClient.estimateGas(transaction, 'latest')
					const value = model.route.deepValue.amountIn - gasLimit * maxFeePerGas
					sendTransactionResult = await wallet.ethereumClient.sendTransaction({ ...transaction, value, gas: gasLimit, maxFeePerGas, maxPriorityFeePerGas: maxFeePerGas })
				} else {
					// special case for simple ETH transfers
					sendTransactionResult = await wallet.ethereumClient.sendTransaction({
						to: model.recipient.deepValue,
						value: model.route.deepValue.amountIn,
						data: new Uint8Array(0),
					})
				}
			} else if (model.route.deepValue.source === model.route.deepValue.target && typeof model.route.deepValue.source.address === 'bigint') {
				// special case for simple token transfers
				const tokenAddress = model.route.deepValue.source.address
				const token = contract(ERC20, microWeb3Provider, addressBigintToHex(tokenAddress))
				sendTransactionResult = await wallet.ethereumClient.sendTransaction({
					to: tokenAddress,
					value: 0n,
					data: token.transfer.encodeInput({ to: addressBigintToHex(model.recipient.deepValue), value: model.route.deepValue.amountIn }),
				})
			} else if (model.route.deepValue.source.symbol === 'ETH' && model.route.deepValue.target.symbol === 'WETH') {
				// special case for wrapping WETH
				sendTransactionResult = await wallet.ethereumClient.sendTransaction({
					to: WETH_DETAILS.address,
					value: model.route.deepValue.amountIn,
					data: weth.deposit.encodeInput({}),
				})
			} else if (model.route.deepValue.source.symbol === 'WETH' && model.route.deepValue.target.symbol === 'ETH') {
				// special case for unwrapping ETH
				sendTransactionResult = await wallet.ethereumClient.sendTransaction({
					to: WETH_DETAILS.address,
					value: 0n,
					data: weth.withdraw.encodeInput(model.route.deepValue.amountIn)
				})
			} else if (model.route.deepValue.source.symbol !== 'ETH' && needsApproval.value.value) {
				sendTransactionResult = await wallet.ethereumClient.sendTransaction({
					to: getTokenOrWethAddress(model.route.deepValue.source),
					value: 0n,
					data: erc20.approve.encodeInput({ spender: addressBigintToHex(UNISWAP_ROUTER_ADDRESS), amount: model.route.deepValue.amountIn })
				})
			} else {
				// swap and send
				const tokenIn = getTokenOrWethAddressString(model.route.deepValue.source)
				const tokenOut = getTokenOrWethAddressString(model.route.deepValue.target)
				const transactions = [
					model.route.deepValue.userSpecifiedValue === 'source'
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
					value: model.route.deepValue.source.symbol === 'ETH' ? model.route.deepValue.amountIn : 0n,
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
		function getButtonText() {
			if (model.recipient.deepValue === 0n) return 'Burn'
			if (model.sourceToken.value === model.targetToken.value) {
				if (model.recipient.deepValue === model.wallet.value.address) return 'Self Send'
				else return 'Send'
			}
			if (model.sourceToken.value.symbol === 'ETH' && model.targetToken.value.symbol === 'WETH') {
				if (model.recipient.deepValue === model.wallet.value.address) return 'Wrap'
				else return 'Wrap and Send'
			}
			if (model.sourceToken.value.symbol === 'WETH' && model.targetToken.value.symbol === 'ETH') {
				if (model.recipient.deepValue === model.wallet.value.address) return 'Unwrap'
				else return 'Unwrap and Send'
			}
			if (needsApproval.value.state === 'resolved' && needsApproval.value.value) return 'Approve'
			if (model.recipient.deepValue === model.wallet.value.address) return 'Swap'
			else return 'Swap and Send'
		}
		const text = getButtonText()
		const disabled = model.recipient.deepValue !== model.wallet.value.address && ((model.sourceToken.value.symbol === 'ETH' && model.targetToken.value.symbol === 'WETH') || (model.sourceToken.value.symbol === 'WETH' && model.targetToken.value.symbol === 'ETH'))
		return <button onClick={onClick} disabled={disabled}>{text}</button>
	})
	return sendResult.value.state === 'pending' || needsApproval.value.state === 'pending'
		? <Spinner/>
		: <SwapButton_/>
}

function getTokenOrWethAddress(asset: AssetDetails): bigint {
	return asset.symbol === 'ETH'
		? WETH_DETAILS.address
		: asset.address as bigint
}

function getTokenOrWethAddressString(asset: AssetDetails): string {
	return addressBigintToHex(getTokenOrWethAddress(asset))
}
