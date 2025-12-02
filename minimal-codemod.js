// minimal-codemod.js
export default function transformer(file, api) {
  const j = api.jscodeshift;
  return j(file.source).insertBefore("// This is a test comment").toSource();
}
