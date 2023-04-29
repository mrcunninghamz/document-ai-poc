# Introduction
I suppose we are creating a thing that gives meaningful responses from chatgpt with some documentation we created as part of a context.

# Setup
Add documentation `.md` files to the `data` folder in the root directory.

Update `config.json.bak` to include your api keys and rename it to `config.json`

run
```
node upload.js
```

# Run
```
node query.js
```

# Debug
Setting the env variable to debug will console log out the prompt and let you know when its sent to chat gpt and a resonse is returned.
```
NODE_ENV=debug node query.js
```

# References
- https://docs.embedbase.xyz/tutorials/nextra-qa-docs