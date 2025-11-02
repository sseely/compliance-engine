// Polyfill "fetch" for Node.js environments
import { TextEncoder, TextDecoder } from 'util'
import { ReadableStream } from 'web-streams-polyfill'

// Polyfill fetch for Node.js
if (!global.fetch) {
  global.fetch = require('node-fetch')
}

// Polyfill TextEncoder/TextDecoder
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Polyfill ReadableStream
global.ReadableStream = ReadableStream

// Polyfill Request/Response for Node.js
if (!global.Request) {
  global.Request = require('node-fetch').Request
}

if (!global.Response) {
  global.Response = require('node-fetch').Response
}

// Polyfill Headers for Node.js
if (!global.Headers) {
  global.Headers = require('node-fetch').Headers
}