import "preact/debug" // remove in production
import "preact/devtools"
import * as preact from 'preact'
import { App, AppModel } from './components/App.js'

// create our root model as a proxy object that will auto-rerender anytime its properties (recursively) change
const rootModel = {} satisfies AppModel

// put the root model on the window for debugging convenience
declare global { interface Window { rootModel: AppModel } }
window.rootModel = rootModel

// specify our render function, which will be fired anytime rootModel is mutated
function rerender() {
	const element = preact.createElement(App, rootModel)
	preact.render(element, document.body)
}

// kick off the initial render
rerender()
