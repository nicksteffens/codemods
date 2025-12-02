# Codemods

Personal [jscodeshift](https://github.com/facebook/jscodeshift) codemods for framework migrations and refactoring.

## Directory Structure

Codemods are organized by framework/tool:

```
codemods/
  mui/                  # MUI/Material-UI transforms
  react/                # React-specific transforms
  ember/                # Ember.js transforms
  percy/                # Percy → local screenshot migration
  cypress/              # Cypress test transforms
  storybook/            # Storybook transforms
  movable-ink/          # Movable Ink specific transforms
  _templates/           # Blueprint templates for new codemods
```

## Usage

```bash
# Run a codemod on target files
npx jscodeshift -t <codemod-path> <target-files>

# Example: Transform MUI imports
npx jscodeshift -t mui/material.js 'src/**/*.tsx'

# Dry run (no changes written)
npx jscodeshift -t mui/material.js 'src/**/*.tsx' --dry

# Print transformed output
npx jscodeshift -t mui/material.js 'src/**/*.tsx' --print
```

## Creating a New Codemod

1. Create a new file in the appropriate directory (or create the directory if it doesn't exist)
2. Use the blueprint template as a starting point:

```bash
cp _templates/transform.js <framework>/<transform-name>.js
```

3. Implement your transform following the jscodeshift API

### Codemod Blueprint

```javascript
/**
 * @description Brief description of what this codemod does
 * @example
 * // Before
 * import { foo } from 'old-package';
 *
 * // After
 * import { foo } from 'new-package';
 */
export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Find and transform AST nodes
  root
    .find(j.ImportDeclaration, {
      source: { value: 'old-package' }
    })
    .forEach(path => {
      path.node.source.value = 'new-package';
    });

  return root.toSource({ quote: 'single' });
}
```

## Helpful Resources

- [jscodeshift docs](https://github.com/facebook/jscodeshift)
- [AST Explorer](https://astexplorer.net/) - Use parser `@babel/parser` and transform `jscodeshift`
- [jscodeshift recipes](https://github.com/codemod-js/codemod/tree/main/packages/matchers)

## Testing Codemods

```bash
# Test on a single file
npx jscodeshift -t <codemod>.js test-file.tsx --dry --print

# Run with babel parser for TypeScript/JSX
npx jscodeshift -t <codemod>.js 'src/**/*.tsx' --parser=tsx
```

## Existing Codemods

### mui/
- `material.js` - Transform `@material-ui/*` → `@mui/material`
- `icons-material.js` - Transform `@material-ui/icons` → `@mui/icons-material`

### percy/ (planned)
- `cypress-percy-to-screenshot.js` - Transform `cy.percySnapshot()` → `cy.screenshot()`
- `ember-percy-to-screenshot.js` - Transform Percy helper to local screenshot
- `remove-percy-imports.js` - Remove `@percy/*` imports
