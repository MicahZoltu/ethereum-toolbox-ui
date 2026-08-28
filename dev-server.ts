// NOTE: Not secure!  Will happily read `../../../private-file.txt` via crafted URLs.  This is a dev server and should not be exposed to the internet.
const server = Bun.serve({
	port: 12345,
	async fetch(request) {
		const urlPath = new URL(request.url).pathname
		try {
			const filePath = decodeURI(`./app${ urlPath.endsWith('/') ? `${ urlPath }index.html` : urlPath }`)
			const file = Bun.file(filePath)
			if (await file.exists()) {
				return new Response(file)
			}
			console.log(`404: ${ urlPath }`)
			return new Response(null, { status: 404 })
		} catch (error) {
			console.log(`500: ${ urlPath }\n${ error instanceof Error ? error.message : error }`)
			return new Response(null, { status: 500 })
		}
	},
})

console.log(`Web Server listening at http://localhost:${ server.port } ...`)
