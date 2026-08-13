import handler from './api/parse-url.js'

async function run() {
  const req = {
    method: 'POST',
    body: { url: 'https://www.instagram.com/reel/C-M-Zq3t8yO/' }
  }
  const res = {
    setHeader: () => {},
    status: (code) => {
      return {
        json: (data) => console.log(code, data),
        end: () => console.log(code),
        send: (d) => console.log(code, 'Buffer of size', d.length)
      }
    }
  }
  await handler(req, res)
}
run()
