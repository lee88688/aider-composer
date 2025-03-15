# Contributing

## Requirements

- Node.js
- Python 3

## Setup

1. Install npm dependencies on the project root directory:

```bash
npm install
```

2. Install ui project npm dependencies:

```bash
cd ui
npm install
```

3. Install python dependencies the same way you use this project:

```bash
pip install aider-chat flask
```

4. Start up python server:

```bash
python -m flask -A server/main.py run --port 5000
```

5. Start up web ui:

```bash
npm run dev-ui
```

6. Open this project with VSCode, open [VSCode Debug](https://code.visualstudio.com/docs/editor/debugging#_debugger-user-interface) side bar and on the top of the Debug toolbar, click the run button for "Run Extension" item.

## Build extension

After installing npm dependencies, run the following:

```bash
npm run compile
npm run build
```
