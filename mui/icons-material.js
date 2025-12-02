/**
 * This codemod transforms MUI icon imports to import directly from the module.
 *
 * For example, it changes:
 *
 * import { Menu } from '@mui/icons-material';
 *
 * to:
 *
 * import Menu from '@mui/icons-material/Menu';
 */
export default function transformer(file, api) {
  const j = api.jscodeshift;

  return j(file.source)
    .find(j.ImportDeclaration, {
      source: {
        value: "@mui/icons-material",
      },
    })
    .forEach((path) => {
      const declarations = path.node.specifiers
        .map((specifier) => {
          if (specifier.type === "ImportSpecifier") {
            return j.importDeclaration(
              [j.importDefaultSpecifier(j.identifier(specifier.imported.name))],
              j.literal(`@mui/icons-material/${specifier.imported.name}`)
            );
          }
          return null;
        })
        .filter(Boolean);

      j(path).replaceWith(declarations);
    })
    .toSource({ quote: "single" });
}
