'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function (defaults) {
  const app = new EmberApp(defaults, {
    babel: {
      plugins: [
        require.resolve('ember-rfc-502-explicit-services-polyfill/babel-plugin'),
      ],
    },
  });

  return app.toTree();
};
