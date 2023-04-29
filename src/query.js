import readline from 'readline'
import config from '../configuration/config.json' assert { type: "json" }
import { get_encoding } from '@dqbd/tiktoken'
import {
    createParser
  } from 'eventsource-parser'
const isDebug = process.env.NODE_ENV === 'debug'
const enc = get_encoding('cl100k_base')

const search = async (query) => {
return fetch(
    `https://api.embedbase.xyz/v1/${config.Dataset_Id}/search`,
    {
    method: 'POST',
    headers: {
        Authorization: 'Bearer ' + config.EMBEDBASE_API_KEY,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        query: query
    })
    }
).then(response => response.json())
}
   
const createContext = async (question, maxLen = 1800) => {
// get the similar data to our query from the database
const searchResponse = await search(question)
let curLen = 0
const returns = []
// We want to add context to some limit of length (tokens)
// because usually LLM have limited input size
for (const similarity of searchResponse['similarities']) {
    const sentence = similarity['data']
    // count the tokens
    const nTokens = enc.encode(sentence).length
    // a token is roughly 4 characters, to learn more
    // https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them
    curLen += nTokens + 4
    if (curLen > maxLen) {
    break
    }
    returns.push(sentence)
}
// we join the entries we found with a separator to show it's different
return returns.join('\n\n###\n\n')
}


async function buildPrompt(query){
    const context = await createContext(query)
    const newPrompt = `Answer the question based on the context below, and if the question can't be answered based on the context, say "I don't know". Do not respond with suggesting tolook at the context above as the answer, do your best to at least summarize what you know about the possible asnwer. Do not mention the context in the answer."\n\nContext: ${context}\n\n---\n\nQuestion: ${query}\nAnswer:`
    return newPrompt
}

async function run(query){
    return new Promise(async (resolve, reject) => {
        var newPrompt = await buildPrompt(query)
        debugLog(newPrompt)

        debugLog('Sending prompt to ChatGPT')
        const payload = {
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: newPrompt }],
            temperature: 0.7,
            max_tokens: 1099,
            stream: true
        }
        var stream = await OpenAIStream(payload)

        if (!stream) {
            reject("no stream coming back from open ai")
        } 
        
        debugLog('Getting response from ChatGPT')
        const reader = stream.getReader()
        const decoder = new TextDecoder()
        let done = false
        // read the streaming ChatGPT answer
        var answer = ""
        while (!done) {
            const { value, done: doneReading } = await reader.read()
            done = doneReading
            const chunkValue = decoder.decode(value)
            // update our interface with the answer
            //setAnswer(prev => prev + chunkValue)
            answer = answer + chunkValue;
            process.stdout.write(`${chunkValue}`);
        }
        resolve(answer)
    })
}


async function OpenAIStream(payload) {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
   
    let counter = 0
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.OPENAI_API_KEY}`
      },
      method: 'POST',
      body: JSON.stringify(payload)
    })
   
    const stream = new ReadableStream({
      async start(controller) {
        // callback
        function onParse(event) {
          if (event.type === 'event') {
            const data = event.data
            // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
            if (data === '[DONE]') {
              controller.close()
              return
            }
            try {
              const json = JSON.parse(data)
              // get the text response from ChatGPT
              const text = json.choices[0]?.delta?.content
              if (!text) return
              if (counter < 2 && (text.match(/\n/) || []).length) {
                // this is a prefix character (i.e., "\n\n"), do nothing
                return
              }
              const queue = encoder.encode(text)
              controller.enqueue(queue)
              counter++
            } catch (e) {
              // maybe parse error
              controller.error(e)
            }
          }
        }
   
        // stream response (SSE) from OpenAI may be fragmented into multiple chunks
        // this ensures we properly read chunks and invoke an event for each SSE event stream
        const parser = createParser(onParse)
        // https://web.dev/streams/#asynchronous-iteration
        for await (const chunk of res.body) {
          parser.feed(decoder.decode(chunk))
        }
      }
    })
   
    return stream
  }

function main() {
return new Promise(function(resolve, reject) {
    let rl = readline.createInterface(process.stdin, process.stdout)
    rl.setPrompt('How can I help you? ')
    rl.prompt()
    rl.on('line', async function(line) {
    if (line === "exit" || line === "quit" || line == 'q') {
        rl.close()
        return // bail here, so rl.prompt() isn't called again
    }
    
    var answer = await run(line)
    console.log("\n")
    rl.prompt()

    }).on('close',function(){
    console.log('bye')
    resolve(42) // this is the final result of the function
    });
})
}

function debugLog(message){
    if(isDebug){
        console.log(message)
    }
}

main()