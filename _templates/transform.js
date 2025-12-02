/**
 * @description TODO: Describe what this codemod does
 * @example
 * // Before
 * import { foo } from 'old-package';
 * foo();
 *
 * // After
 * import { bar } from 'new-package';
 * bar();
 */
export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Track if we made any changes
  let hasChanges = false;

  // Example: Find and transform import declarations
  root
    .find(j.ImportDeclaration, {
      source: { value: 'old-package' },
    })
    .forEach((path) => {
      // Transform the import source
      path.node.source.value = 'new-package';
      hasChanges = true;
    });

  // Example: Find and rename function calls
  root
    .find(j.CallExpression, {
      callee: { name: 'oldFunction' },
    })
    .forEach((path) => {
      path.node.callee.name = 'newFunction';
      hasChanges = true;
    });

  // Only return modified source if changes were made
  return hasChanges ? root.toSource({ quote: 'single' }) : null;
}
