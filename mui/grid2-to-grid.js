/**
 * Transforms Grid2 imports to Grid for MUI v7+.
 *
 * Run:
 * npx jscodeshift --parser=tsx --extensions=tsx,ts -t mui/grid2-to-grid.js <path>
 *
 * Pattern A — default import from subpath:
 *   import Grid from '@mui/material/Grid2'
 *   → import Grid from '@mui/material/Grid'
 *
 * Pattern B — default import + named type from subpath:
 *   import Grid, { Grid2Props as GridProps } from '@mui/material/Grid2'
 *   → import Grid, { GridProps } from '@mui/material/Grid'
 *
 * Pattern C — named imports from barrel:
 *   import { Grid2 as Grid, Grid2Props as GridProps } from '@mui/material'
 *   → import { Grid, GridProps } from '@mui/material'
 *
 * Pattern D — type-only from barrel:
 *   import { Grid2Props as GridProps } from '@mui/material'
 *   → import { GridProps } from '@mui/material'
 */
export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  // Local binding renames produced by rewriting import specifiers, e.g. an
  // unaliased `import { Grid2 }` becomes `import { Grid }`, which changes the
  // local name Grid2 → Grid. Every reference to that binding (JSX tags, value
  // and type identifiers) must be renamed too, or it dangles.
  const localRenames = new Map(); // oldLocal -> newLocal

  // Rename the imported name of a specifier: Grid2 → Grid, Grid2Props → GridProps.
  // Returns the (possibly new) imported name string.
  function renameImported(name) {
    if (name === 'Grid2') return 'Grid';
    if (name === 'Grid2Props') return 'GridProps';
    return name;
  }

  // Rewrite specifiers whose imported name needs renaming.
  // If after renaming, imported === local, drop the alias.
  function rewriteSpecifiers(specifiers) {
    return specifiers.map((spec) => {
      if (spec.type !== 'ImportSpecifier') return spec;

      const oldImported = spec.imported.name;
      const newImported = renameImported(oldImported);

      if (newImported === oldImported) return spec; // nothing to do

      const localName = spec.local.name;
      // If the alias was just tracking the old name (e.g. Grid2 as Grid2),
      // or the local name matches the new imported name, drop the alias.
      const newLocal = localName === oldImported ? newImported : localName;
      const dropAlias = newLocal === newImported;

      // Record local binding renames so references can be updated below.
      if (newLocal !== localName) {
        localRenames.set(localName, newLocal);
      }

      const newSpec = j.importSpecifier(
        j.identifier(newImported),
        dropAlias ? j.identifier(newImported) : j.identifier(newLocal)
      );
      // Preserve import kind (type vs value) if present
      if (spec.importKind) newSpec.importKind = spec.importKind;
      return newSpec;
    });
  }

  // Rename every reference to a renamed local binding. Runs after imports are
  // rewritten, so the import specifiers themselves are already updated and the
  // remaining matches are usages in the file body.
  function renameLocalReferences() {
    if (localRenames.size === 0) return;

    // JSX tag names: <Grid2>, </Grid2>, <Grid2.Foo>.
    root.find(j.JSXIdentifier).forEach((path) => {
      const newName = localRenames.get(path.node.name);
      if (newName) {
        path.node.name = newName;
        dirty = true;
      }
    });

    // Value and type identifiers: styled(Grid2), `x: Grid2Props`, etc.
    root.find(j.Identifier).forEach((path) => {
      const newName = localRenames.get(path.node.name);
      if (!newName) return;

      const parent = path.parent.node;
      // Import specifiers were already rewritten above — don't touch them.
      if (
        parent.type === 'ImportSpecifier' ||
        parent.type === 'ImportDefaultSpecifier' ||
        parent.type === 'ImportNamespaceSpecifier'
      ) {
        return;
      }
      // Non-computed member property access: foo.Grid2 is not this binding.
      if (
        parent.type === 'MemberExpression' &&
        parent.property === path.node &&
        !parent.computed
      ) {
        return;
      }
      // Object property keys (non-shorthand): { Grid2: ... } is not a reference.
      if (
        (parent.type === 'ObjectProperty' || parent.type === 'Property') &&
        parent.key === path.node &&
        !parent.shorthand
      ) {
        return;
      }

      path.node.name = newName;
      dirty = true;
    });
  }

  // --- Patterns A & B: subpath import '@mui/material/Grid2' ---
  root
    .find(j.ImportDeclaration, { source: { value: '@mui/material/Grid2' } })
    .forEach((path) => {
      path.node.source = j.literal('@mui/material/Grid');
      path.node.specifiers = rewriteSpecifiers(path.node.specifiers);
      dirty = true;
    });

  // --- Patterns C & D: barrel import '@mui/material' with Grid2 / Grid2Props specifiers ---
  root
    .find(j.ImportDeclaration, { source: { value: '@mui/material' } })
    .forEach((path) => {
      const hasGrid2Specifier = path.node.specifiers.some(
        (spec) =>
          spec.type === 'ImportSpecifier' &&
          (spec.imported.name === 'Grid2' || spec.imported.name === 'Grid2Props')
      );

      if (!hasGrid2Specifier) return;

      path.node.specifiers = rewriteSpecifiers(path.node.specifiers);
      dirty = true;
    });

  // Propagate any local binding renames to their references (JSX, identifiers).
  renameLocalReferences();

  return dirty ? root.toSource({ quote: 'single' }) : file.source;
}
