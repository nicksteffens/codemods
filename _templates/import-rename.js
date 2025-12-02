/**
 * @description Rename imports from one package to another
 * @example
 * // Before
 * import { Component } from 'old-package';
 * import Default from 'old-package';
 *
 * // After
 * import { Component } from 'new-package';
 * import Default from 'new-package';
 */

// Configure the transform
const CONFIG = {
  oldPackage: 'old-package',
  newPackage: 'new-package',
  // Optional: rename specific imports { oldName: 'newName' }
  renameImports: {},
};

export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  let hasChanges = false;

  root
    .find(j.ImportDeclaration, {
      source: { value: CONFIG.oldPackage },
    })
    .forEach((path) => {
      // Update package name
      path.node.source.value = CONFIG.newPackage;
      hasChanges = true;

      // Optionally rename specific imports
      if (Object.keys(CONFIG.renameImports).length > 0) {
        path.node.specifiers.forEach((specifier) => {
          if (
            specifier.type === 'ImportSpecifier' &&
            CONFIG.renameImports[specifier.imported.name]
          ) {
            specifier.imported.name = CONFIG.renameImports[specifier.imported.name];
          }
        });
      }
    });

  return hasChanges ? root.toSource({ quote: 'single' }) : null;
}
