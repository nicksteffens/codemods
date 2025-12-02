export default function transformer(file, api) {
  const j = api.jscodeshift;

  return j(file.source)
    .replaceWith(file.source.replace("Hello", "Goodbye"))
    .toSource();
}
