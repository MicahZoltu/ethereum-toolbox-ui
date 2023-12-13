export function CloseButton(model: { onClick: () => void }) {
	return <button onClick={model.onClick} class='close-button'>❌</button>
}