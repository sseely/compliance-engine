// Polyfills for Jest test environment
// Node.js 18+ has native fetch, TextEncoder, TextDecoder, etc.
// These polyfills are only needed for ReadableStream in jsdom environment

const { TextEncoder, TextDecoder } = require('util')
const { ReadableStream } = require('web-streams-polyfill')

// Polyfill TextEncoder/TextDecoder (jsdom may not have these)
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Polyfill ReadableStream
global.ReadableStream = ReadableStream
