import { JSX } from "preact/jsx-runtime"

export type RefreshModel = {
	onClick: () => void
	class?: JSX.HTMLAttributes['class']
	style?: JSX.CSSProperties
}

export function Refresh(model: RefreshModel) {
	return <button onClick={model.onClick} style={{ border: 'none', padding: '0', margin: '0', ...model.style }} class={model.class}>↻</button>
}
