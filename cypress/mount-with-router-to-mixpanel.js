/**
 * Codemod: mountWithRouter → mountWithMixpanel
 *
 * Migrates Cypress component tests from cy.mountWithRouter to cy.mountWithMixpanel
 *
 * Usage:
 *   npx jscodeshift -t cypress/mount-with-router-to-mixpanel.js <path-to-test-files>
 *
 * Example:
 *   npx jscodeshift -t cypress/mount-with-router-to-mixpanel.js src/**/*.cy.tsx
 *
 * Before:
 *   cy.mountWithRouter(<Component />);
 *
 * After:
 *   cy.mountWithMixpanel(<Component />);
 */

export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);
  let hasChanges = false;

  // Find all cy.mountWithRouter(...) calls and replace with cy.mountWithMixpanel
  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: { name: 'cy' },
        property: { name: 'mountWithRouter' },
      },
    })
    .forEach((path) => {
      path.node.callee.property.name = 'mountWithMixpanel';
      hasChanges = true;
    });

  return hasChanges ? root.toSource({ quote: 'single' }) : null;
}
