# Demo source (local F5 fixture)

Each chapter is a **directory snapshot** with nested `src/` files:

| Dir      | Role                     | Layout                                           |
| -------- | ------------------------ | ------------------------------------------------ |
| `start/` | hello starts here        | `src/index.ts`, `src/greeting/{config,types}.ts` |
| `hello/` | hello goal / world start | adds `src/greeting/greeter.ts`                   |
| `world/` | world goal / bang start  | adds `src/greeting/format/parts.ts`              |
| `bang/`  | bang goal                | emphasize → `hello world!`                       |
