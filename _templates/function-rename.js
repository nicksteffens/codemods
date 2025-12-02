/**
 * @description Rename function calls (including method calls)
 * @example
 * // Before
 * oldFunction(arg1, arg2);
 * obj.oldMethod();
 *
 * // After
 * newFunction(arg1, arg2);
 * obj.newMethod();
 */

// Configure the transform
const CONFIG = {
  // Standalone function renames { oldName: 'newName' }
  functions: {
    oldFunction: 'newFunction',
  },
  // Method call renames { oldName: 'newName' }
  methods: {
    oldMethod: 'newMethod',
  },
};

export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  let hasChanges = false;

  // Rename standalone function calls
  Object.entries(CONFIG.functions).forEach(([oldName, newName]) => {
    root
      .find(j.CallExpression, {
        callee: { type: 'Identifier', name: oldName },
      })
      .forEach((path) => {
        path.node.callee.name = newName;
        hasChanges = true;
      });
  });

  // Rename method calls (e.g., obj.method())
  Object.entries(CONFIG.methods).forEach(([oldName, newName]) => {
    root
      .find(j.CallExpression, {
        callee: {
          type: 'MemberExpression',
          property: { name: oldName },
        },
      })
      .forEach((path) => {
        path.node.callee.property.name = newName;
        hasChanges = true;
      });
  });

  return hasChanges ? root.toSource({ quote: 'single' }) : null;
}
