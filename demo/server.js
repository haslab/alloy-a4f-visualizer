import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' }

http.createServer((request, response) => {
    const relative = request.url === '/' ? '/demo/index.html' : request.url
    const file = path.resolve(root, `.${relative}`)
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        response.writeHead(404)
        response.end('Not found')
        return
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(response)
}).listen(4173, () => console.log('Alloy visualizer demo: http://localhost:4173'))
