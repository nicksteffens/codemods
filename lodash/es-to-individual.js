export default function transformer(file, api) {
  const j = api.jscodeshift;

  return j(file.source)
    .find(j.ImportDeclaration, {
      source: {
        value: "lodash-es",
      },
    })
    .forEach((path) => {
      const declarations = path.node.specifiers
        .map((specifier) => {
          if (specifier.type === "ImportSpecifier") {
            return j.importDeclaration(
              [j.importDefaultSpecifier(j.identifier(specifier.imported.name))],
              j.literal(`lodash/${specifier.imported.name}`)
            );
          }
          return null;
        })
        .filter(Boolean);

      j(path).replaceWith(declarations);
    })
    .toSource({ quote: "single" });
}
