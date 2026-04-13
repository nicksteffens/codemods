/**
 * Transforms theme.palette.* to theme.vars.palette.* inside styled component
 * callbacks and theme override functions.
 *
 * Run:
 * npx jscodeshift --parser=tsx --extensions=tsx,ts -t mui/theme-css-vars.js <path>
 *
 * Examples:
 *   theme.palette.text.primary   → theme.vars.palette.text.primary
 *   theme.palette.primary.main   → theme.vars.palette.primary.main
 *   theme.palette.neutral300     → theme.vars.palette.neutral300
 *
 * Only transforms chains where the root is an identifier named `theme`.
 * Static references like `palette.primary.main` are left untouched.
 */
export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  // Detect whether a MemberExpression is exactly `theme.palette`
  // (i.e. object is Identifier "theme", property is Identifier "palette").
  function isThemePalette(node) {
    return (
      node.type === 'MemberExpression' &&
      !node.computed &&
      node.object.type === 'Identifier' &&
      node.object.name === 'theme' &&
      node.property.type === 'Identifier' &&
      node.property.name === 'palette'
    );
  }

  // Find all MemberExpression nodes whose object is `theme.palette`
  // and insert `.vars` between `theme` and `.palette`.
  //
  // Before: MemberExpression { object: theme.palette, property: text }
  //   which itself may be the object of another MemberExpression (e.g. .primary)
  //
  // After:  MemberExpression { object: theme.vars.palette, property: text }
  //
  // We target the *outermost* theme.palette.* chain so we only mutate once.
  // Walking all MemberExpressions and checking isThemePalette(node.object)
  // means we catch every `theme.palette.X` regardless of depth.

  root.find(j.MemberExpression).forEach((path) => {
    if (!isThemePalette(path.node.object)) return;

    // Replace the object (currently `theme.palette`) with `theme.vars.palette`
    path.node.object = j.memberExpression(
      j.memberExpression(j.identifier('theme'), j.identifier('vars')),
      j.identifier('palette')
    );
    dirty = true;
  });

  return dirty ? root.toSource({ quote: 'single' }) : file.source;
}
