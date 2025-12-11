# :cli 📁

<a href="https://www.npmjs.com/package/coloncli"><img src="https://img.shields.io/npm/v/coloncli.svg" alt="npm version"></a>
<a href="https://www.npmjs.com/package/coloncli"><img src="https://img.shields.io/npm/dw/coloncli.svg" alt="npm downloads/week"></a>

Interactive script picker for npm scripts with automatic folder grouping.

## Usage

Run `npx coloncli` to browse and execute your scripts.

```
npx coloncli
```

OR, add to your `package.json`:

```
npm i -D coloncli
```

And add the script:

```json
{
  "scripts": {
    ":": "coloncli"
  }
}
```

Then you can run `npm run :`.

## How it works

Scripts with colons are automatically grouped into folders. For example:

```json
{
  "scripts": {
    "dev:project-a": "vite --config project-a",
    "dev:project-b": "vite --config project-b",
    "build:web:prod": "vite build --config web-prod",
    "build:web:beta": "vite build --config web-beta",
    "build:mobile:prod": "vite build --config mobile-prod",
    "build:mobile:beta": "vite build --config mobile-beta",
  }
}
```

Navigation:

- `dev` → shows `project-a` / `project-b` in a list
- `build` → shows `web` / `mobile` in a list → they each show `prod` / `beta` in a list

Scripts without colons appear directly in the menu.
