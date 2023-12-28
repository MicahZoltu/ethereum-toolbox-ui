import { ReadonlySignal, useComputed, useSignal } from "@preact/signals"
import { useEffect, useState } from "preact/hooks"

export function Countdown(model: {
	seconds: ReadonlySignal<bigint>
}) {
	function now() { return BigInt(Math.round(Date.now() / 1000)) }
	const startSeconds = useSignal(now())
	const nowSeconds = useSignal(now())
	useEffect(() => clearInterval.bind(undefined, setInterval(() => nowSeconds.value = now(), 1000), []))
	const remainingSeconds = useComputed(() => model.seconds.value - (nowSeconds.value - startSeconds.value))
	const yearsRemaining = useComputed(() => remainingSeconds.value / 60n / 60n / 24n / 7n / 52n)
	const weeksRemaining = useComputed(() => remainingSeconds.value / 60n / 60n / 24n / 7n % 52n)
	const daysRemaining = useComputed(() => remainingSeconds.value / 60n / 60n / 24n % 7n)
	const hoursRemaining = useComputed(() => remainingSeconds.value / 60n / 60n % 24n)
	const minutesRemaining = useComputed(() => remainingSeconds.value / 60n % 60n)
	const secondsRemaining = useComputed(() => remainingSeconds.value % 60n)
	const [Years_] = useState(() => () => yearsRemaining.value !== 0n ? <span>{yearsRemaining.value.toString(10)} {yearsRemaining.value === 1n ? 'year' : 'years'}</span> : <></>)
	const [Weeks_] = useState(() => () => weeksRemaining.value !== 0n ? <span>{weeksRemaining.value.toString(10)} {weeksRemaining.value === 1n ? 'week' : 'weeks'}</span> : <></>)
	const [Days_] = useState(() => () => daysRemaining.value !== 0n ? <span>{daysRemaining.value.toString(10)} {daysRemaining.value === 1n ? 'day' : 'days'}</span> : <></>)
	const [Hours_] = useState(() => () => hoursRemaining.value !== 0n ? <span>{hoursRemaining.value.toString(10)} {hoursRemaining.value === 1n ? 'hour' : 'hours'}</span> : <></>)
	const [Minutes_] = useState(() => () => minutesRemaining.value !== 0n ? <span>{minutesRemaining.value.toString(10)} {minutesRemaining.value === 1n ? 'minute' : 'minutes'}</span> : <></>)
	const [Seconds_] = useState(() => () => secondsRemaining.value !== 0n ? <span>{secondsRemaining.value.toString(10)} {secondsRemaining.value === 1n ? 'second' : 'seconds'}</span> : <></>)
	return <span><Years_/><Weeks_/><Days_/><Hours_/><Minutes_/><Seconds_/></span>
}
