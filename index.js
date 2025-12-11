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

// Recursive function to handle script selection at any level
async function selectScript(prefix, scriptsToShow, allScripts) {
  // Group scripts by next level
  const nextLevelGroups = new Map()
  const directScripts = []

  for (const { name, command } of scriptsToShow) {
    const remaining = prefix ? name.substring(prefix.length + 1) : name
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
    // If only one script in this group, show the full remaining path
    if (scripts.length === 1) {
      const { name, command } = scripts[0]
      const remaining = prefix ? name.substring(prefix.length + 1) : name
      if (remaining.includes(":")) {
        // Still has more levels, show as prefix but with full remaining path
        const nextPrefix = prefix ? `${prefix}:${nextLevel}` : nextLevel
        choices.push({
          name: remaining,
          description: command,
          value: { type: "prefix", prefix: nextPrefix },
        })
      } else {
        // Final script, show as script with full name
        choices.push({
          name,
          description: command,
          value: { type: "script", scriptName: name },
        })
      }
    } else {
      // Multiple scripts, show as folder
      const displayPrefix = prefix ? `${prefix}:${nextLevel}` : nextLevel
      choices.push({
        name: `${nextLevel} / ...`,
        description: `→ ${scripts.length} scripts`,
        value: { type: "prefix", prefix: displayPrefix },
      })
    }
  }

  // Add direct scripts (no more colons)
  for (const { name, command } of directScripts) {
    choices.push({
      name,
      description: command,
      value: { type: "script", scriptName: name },
    })
  }

  // If only one choice, auto-select it
  if (choices.length === 1) {
    const selection = choices[0]
    if (selection.value.type === "script") {
      return selection.value.scriptName
    } else {
      // Auto-continue to next level for prefix
      const nextScripts = allScripts.filter(({ name }) =>
        name.startsWith(selection.value.prefix + ":"),
      )
      return selectScript(selection.value.prefix, nextScripts, allScripts)
    }
  }

  // Prompt user to select
  const message = prefix ? `Select a ${prefix} script:` : "Select a script to run:"
  const selection = await select({
    message,
    choices,
    pageSize: 50,
  })

  if (selection.type === "script") {
    return selection.scriptName
  } else {
    // Continue to next level
    const nextScripts = allScripts.filter(({ name }) => name.startsWith(selection.prefix + ":"))
    return selectScript(selection.prefix, nextScripts, allScripts)
  }
}

// Build initial scripts list maintaining order from package.json
const initialScripts = []
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
    // Add scripts grouped by left side, maintaining order
    if (!seenLeftSides.has(leftSide)) {
      seenLeftSides.add(leftSide)
      initialScripts.push(...scriptsWithColons.get(leftSide))
    }
  } else {
    // Add scripts without colons in their original order
    initialScripts.push({ name, command })
  }
}

// Start the recursive selection process
const selectedScript = await selectScript(null, initialScripts, initialScripts)

// Execute the selected script
console.log(`\nRunning: npm run ${selectedScript}\n`)
try {
  execSync(`npm run ${selectedScript}`, { stdio: "inherit", cwd: process.cwd() })
} catch (error) {
  process.exit(error.status || 1)
}
