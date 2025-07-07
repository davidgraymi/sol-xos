const webpack = require('webpack');
const path = require('path');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin'); // Import the plugin

module.exports = function override(config, env) {
  const fallback = config.resolve.fallback || {};
  Object.assign(fallback, {
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "assert": require.resolve("assert"),
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "os": require.resolve("os-browserify"),
    "url": require.resolve("url"),
    "vm": require.resolve("vm-browserify")
  });
  config.resolve.fallback = fallback;

  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
    }),
  ]);

  // Disable fully specified resolution for .js and .mjs files in node_modules
  config.module.rules.push({
    test: /\.m?js/,
    resolve: {
      fullySpecified: false,
    },
  });

  // *** Remove or modify ModuleScopePlugin ***
  // This is the key to allowing imports outside of src/
  config.resolve.plugins = config.resolve.plugins.filter(plugin => !(plugin instanceof ModuleScopePlugin));

  // --- Optional: Re-add the react-refresh include, though disabling ModuleScopePlugin usually makes this unnecessary ---
  // If you still see React Refresh related errors after disabling ModuleScopePlugin,
  // uncomment and verify this section. Otherwise, it might not be needed.
  // const oneOfRule = config.module.rules.find((rule) => rule.oneOf);
  // if (oneOfRule) {
  //   const jsRule = oneOfRule.oneOf.find(
  //     (rule) => rule.test && rule.test.toString().includes('js|mjs|jsx|ts|tsx') && rule.include && rule.include.includes(path.resolve(__dirname, 'src'))
  //   );
  //
  //   if (jsRule) {
  //     if (!Array.isArray(jsRule.include)) {
  //       jsRule.include = [jsRule.include];
  //     }
  //     jsRule.include.push(path.resolve(__dirname, 'node_modules/react-refresh'));
  //     console.log("Modified Babel loader include paths for src rule:", jsRule.include);
  //   } else {
  //     console.warn("Could not find the specific Babel loader rule for src/. React Refresh might not work correctly.");
  //   }
  // } else {
  //   console.warn("Could not find a 'oneOf' rule in Webpack config.");
  // }
  // --------------------------------------------------------------------------------------------------------------------


  // For ignoring source map warnings if they appear due to polyfills
  config.ignoreWarnings = [/Failed to parse source map/];

  return config;
};
