'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

const ownerPolyfill =
  require.resolve('babel-plugin-ember-polyfill-get-and-set-owner-from-ember-owner');

module.exports = function (defaults) {
  const app = new EmberApp(defaults, {
    babel: {
      plugins: [
        ownerPolyfill,
        require.resolve('ember-rfc-502-explicit-services-polyfill/babel-plugin'),
      ],
    },
    autoImport: {
      webpack: {
        module: {
          rules: [
            {
              test: /\.js$/,
              include: /ember-rfc-502-explicit-services-polyfill/,
              use: {
                loader: require.resolve('babel-loader'),
                options: {
                  babelrc: false,
                  configFile: false,
                  plugins: [ownerPolyfill],
                },
              },
            },
          ],
        },
      },
    },
  });

  return app.toTree();
};
