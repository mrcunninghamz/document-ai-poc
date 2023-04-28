import { createClient } from 'embedbase-js'
import glob from 'glob'
import fs from 'fs'
import config from '../configuration/config.json' assert { type: "json" }
const dataFolder = "data"

async function Upload() {
    var exists = await checkDirectory(dataFolder)

    if(!exists){
        return
    }

    // Change the path format as necessary
    const markdownFiles = glob.sync(`${dataFolder}/**/*.md`)

    const embedbase = createClient('https://api.embedbase.xyz', config.EMBEDBASE_API_KEY)

    markdownFiles.forEach(async (path) => {
        console.log(`Uploading file ${path}... and creating chunks`)

        var chunks = await ChunkDocument(path)

        const datasetId = 'wgo'
        const data = await embedbase.dataset(datasetId).batchAdd(chunks.map((data) => (data)))
        console.log(data)
    });
}

async function ChunkDocument(path) {
    // 1. read all files under pages/* with .mdx extension
    // for each file, read the content
    const document = {
        // we use as id /{pagename} which could be useful to
        // provide links in the UI
        id: path
          .replace(`${dataFolder}/`, '/')
          .replace('index.md', '')
          .replace('.md', ''),
        // content of the file
        data: fs.readFileSync(path, 'utf-8')
      }
   
    // 2. here we split the documents in chunks, you can do it in many different ways, pick the one you prefer
    // split documents into chunks of 100 lines
    const chunks = []
    const lines = document.data.split('\n')
    const chunkSize = 100
    for (let i = 0; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(i, i + chunkSize).join('\n')
        chunks.push({
            // and use id like path/chunkIndex
            id: document.id + '/' + i,
            data: chunk
        })
    }

    return chunks
  }

function checkDirectory(x) {
    return new Promise((resolve) => {
        fs.access(x, function (error) {

            var exists = false;
            if (error) {
                console.log("Directory does not exist.");
            } else {
                console.log("Directory exists.");
                exists = true;
            }
            resolve(exists)
        })
    })
  }

  Upload()