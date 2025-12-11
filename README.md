# : 📁

<a href="https://www.npmjs.com/package/colon"><img src="https://img.shields.io/npm/v/colon.svg" alt="npm version"></a>
<a href="https://www.npmjs.com/package/colon"><img src="https://img.shields.io/npm/dw/colon.svg" alt="npm downloads/week"></a>

```
npm i -D colon
```

Interactive script picker for npm scripts with automatic folder grouping. Run `npm run :` to browse and execute your scripts.

## Usage

```
npx colon
```

Add to your `package.json`:

```json
{
  "scripts": {
    ":": "colon"
  }
}
```

Then run `npm run :` or use `npx colon`.

## How it works

Scripts with colons are automatically grouped into folders:

```json
{
  "scripts": {
    "dev:project-a": "vite --config project-a",
    "dev:project-b": "vite --config project-b",
    "build:web:prod:minify": "vite build --minify"
  }
}
```

Navigation:
- `dev` → shows `project-a` and `project-b`
- `build` → `web` → `prod` → `minify`

Scripts without colons appear directly in the menu.
