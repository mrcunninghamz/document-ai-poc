import promptSync from 'prompt-sync'
import config from '../configuration/config.json' assert { type: "json" }
import { get_encoding } from '@dqbd/tiktoken'

const prompt = promptSync();
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
    const newPrompt = `Answer the question based on the context below, and if the question can't be answered based on the context, say "I don't know"\n\nContext: ${context}\n\n---\n\nQuestion: ${query}\nAnswer:`
    return newPrompt
}

async function run(){
    const query = prompt('What can i do you for?')
    var newPrompt = await buildPrompt(query);
    console.log(newPrompt);
}


run()