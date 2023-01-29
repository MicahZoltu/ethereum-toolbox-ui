import { render } from "preact";
import { useReducer } from "preact/hooks";

export function Apple() {
	const [, forceUpdate] = useReducer<number, undefined>(x => x + 1, 0)
	const child = <input key='1' value={Math.random()}/>
	const shadowHost = <span ref={host => {
		if (host === null) return
		const shadow = host.shadowRoot || host.attachShadow({mode: "open"})
		render(child, shadow)
		// render(child, host)
	}}/>
	return <div>
		<button onClick={() => forceUpdate(undefined)}>Force Update</button>
		{shadowHost}
	</div>
}
