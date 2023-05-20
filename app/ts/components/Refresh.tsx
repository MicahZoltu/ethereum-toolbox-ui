export type RefreshModel = {
	onClick: () => void
}

export function Refresh(model: RefreshModel) {
	return <button onClick={model.onClick}>↻</button>
}
