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

      const newSpec = j.importSpecifier(
        j.identifier(newImported),
        dropAlias ? j.identifier(newImported) : j.identifier(newLocal)
      );
      // Preserve import kind (type vs value) if present
      if (spec.importKind) newSpec.importKind = spec.importKind;
      return newSpec;
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

  return dirty ? root.toSource({ quote: 'single' }) : file.source;
}
