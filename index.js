import { readFileSync } from "node:fs"
import { join } from "node:path"
import { execSync } from "node:child_process"
import { select } from "@inquirer/prompts"

// Find package.json in the current working directory (user's project)
const packageJsonPath = join(process.cwd(), "package.json")
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))

// Get all scripts
const scripts = packageJson.scripts || {}

if (Object.keys(scripts).length === 0) {
  console.error("No scripts found in package.json")
  process.exit(1)
}

// Separate scripts into those with colons and those without
// Use Map to preserve insertion order
const scriptsWithColons = new Map()
const scriptsWithoutColons = []

for (const [name, command] of Object.entries(scripts)) {
  // Ignore scripts that are just a colon
  if (name === ":") {
    continue
  }

  if (name.includes(":")) {
    const leftSide = name.split(":")[0]
    // Ignore scripts that start with colon (no left side)
    if (leftSide === "") {
      continue
    }
    if (!scriptsWithColons.has(leftSide)) {
      scriptsWithColons.set(leftSide, [])
    }
    scriptsWithColons.get(leftSide).push({ name, command })
  } else {
    scriptsWithoutColons.push({ name, command })
  }
}

// Check if we have any scripts left after filtering
const totalScripts = scriptsWithColons.size + scriptsWithoutColons.length

if (totalScripts === 0) {
  console.error("No valid scripts found in package.json")
  process.exit(1)
}

// Create first-level choices: unique left sides + scripts without colons
// Maintain order from package.json
const firstLevelChoices = []

// Add items in order: left sides as they first appear, then scripts without colons
// We'll build this by iterating through scripts in order
const seenLeftSides = new Set()

for (const [name, command] of Object.entries(scripts)) {
  // Ignore scripts that are just a colon
  if (name === ":") {
    continue
  }

  if (name.includes(":")) {
    const leftSide = name.split(":")[0]
    // Ignore scripts that start with colon (no left side)
    if (leftSide === "") {
      continue
    }
    // Add left side when first encountered
    if (!seenLeftSides.has(leftSide)) {
      seenLeftSides.add(leftSide)
      firstLevelChoices.push({
        name: `${leftSide} / ... [${scriptsWithColons.get(leftSide).length} scripts]`,
        value: { type: "prefix", prefix: leftSide },
      })
    }
  } else {
    // Add scripts without colons in their original order
    firstLevelChoices.push({
      name: `${name} — ${command}`,
      value: { type: "script", scriptName: name },
    })
  }
}

// Prompt user to select from first level
const firstSelection = await select({
  message: "Select a script to run:",
  choices: firstLevelChoices,
})

let selectedScript

if (firstSelection.type === "script") {
  // Direct script selection (no colon)
  selectedScript = firstSelection.scriptName
} else {
  // Prefix selected, recursively handle nested levels
  let currentPrefix = firstSelection.prefix
  let remainingScripts = scriptsWithColons.get(currentPrefix)

  while (true) {
    // Group remaining scripts by next level
    const nextLevelGroups = new Map()
    const directScripts = []

    for (const { name, command } of remainingScripts) {
      const remaining = name.substring(currentPrefix.length + 1)
      if (remaining.includes(":")) {
        const nextLevel = remaining.split(":")[0]
        if (!nextLevelGroups.has(nextLevel)) {
          nextLevelGroups.set(nextLevel, [])
        }
        nextLevelGroups.get(nextLevel).push({ name, command })
      } else {
        directScripts.push({ name, command })
      }
    }

    // Build choices for current level
    const choices = []

    // Add grouped next levels
    for (const [nextLevel, scripts] of nextLevelGroups) {
      // If only one script in this group, show the full remaining path instead of folder format
      if (scripts.length === 1) {
        const { name, command } = scripts[0]
        const remaining = name.substring(currentPrefix.length + 1)
        if (remaining.includes(":")) {
          // Still has more levels, show as prefix but with full path
          choices.push({
            name: `${remaining} — ${command}`,
            value: { type: "prefix", prefix: `${currentPrefix}:${nextLevel}` },
          })
        } else {
          // Final script, show as script
          choices.push({
            name: `${remaining} — ${command}`,
            value: { type: "script", scriptName: name },
          })
        }
      } else {
        choices.push({
          name: `${nextLevel} / ... [${scripts.length} scripts]`,
          value: { type: "prefix", prefix: `${currentPrefix}:${nextLevel}` },
        })
      }
    }

    // Add direct scripts (no more colons)
    for (const { name, command } of directScripts) {
      const scriptName = name.substring(currentPrefix.length + 1)
      choices.push({
        name: `${scriptName} — ${command}`,
        value: { type: "script", scriptName: name },
      })
    }

    // If only one choice, auto-select it
    if (choices.length === 1) {
      const selection = choices[0]
      if (selection.value.type === "script") {
        selectedScript = selection.value.scriptName
        break
      } else {
        // Auto-continue to next level for prefix
        currentPrefix = selection.value.prefix
        remainingScripts = remainingScripts.filter(({ name }) =>
          name.startsWith(currentPrefix + ":"),
        )
        continue
      }
    }

    // Prompt user to select
    const selection = await select({
      message: `Select a ${currentPrefix} script:`,
      choices,
    })

    if (selection.type === "script") {
      selectedScript = selection.scriptName
      break
    } else {
      // Continue to next level - filter remaining scripts to those matching the new prefix
      currentPrefix = selection.prefix
      remainingScripts = remainingScripts.filter(({ name }) => name.startsWith(currentPrefix + ":"))
    }
  }
}

// Execute the selected script
console.log(`\nRunning: npm run ${selectedScript}\n`)
try {
  execSync(`npm run ${selectedScript}`, { stdio: "inherit", cwd: process.cwd() })
} catch (error) {
  process.exit(error.status || 1)
}
