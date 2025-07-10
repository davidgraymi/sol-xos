// app/config-overrides.js
const webpack = require("webpack");
const path = require("path");

module.exports = function override(config, env) {
  // Add fallbacks for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve("crypto-browserify"),
    stream: require.resolve("stream-browserify"),
    buffer: require.resolve("buffer"),
    util: require.resolve("util"),
    assert: require.resolve("assert"),
    process: require.resolve("process/browser"),
    path: require.resolve("path-browserify"),
    os: false, // Fixed based on previous analysis
    url: require.resolve("url"),
    http: require.resolve("stream-http"),
    https: require.resolve("https-browserify"),
    vm: require.resolve("vm-browserify"),
  };

  // Add the Buffer and Process plugins for global access
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
    }),
  ]);

  // Set fullySpecified to false to allow bare imports to resolve without extensions
  config.resolve.fullySpecified = false;

  // Explicit aliases for process/browser and react-refresh/runtime
  // MODIFIED: Adding more robust aliases for 'process'
  config.resolve.alias = {
    ...config.resolve.alias,
    // Ensure all 'process' related imports map to the browser polyfill
    "process/browser": path.resolve(
      __dirname,
      "node_modules/process/browser.js"
    ),
    "process/browser.js": path.resolve(
      __dirname,
      "node_modules/process/browser.js"
    ), // Add this to catch explicit '.js' requests
    process: path.resolve(__dirname, "node_modules/process/browser.js"), // Add this for bare 'process' imports
    "react-refresh/runtime": path.resolve(
      __dirname,
      "node_modules/react-refresh/runtime.js"
    ),
  };

  // Disable symlink resolution.
  config.resolve.symlinks = false;

  // NEW: Find and modify the ModuleScopePlugin to explicitly allow react-refresh path
  const ModuleScopePlugin = config.resolve.plugins.find(
    (p) => p.constructor && p.constructor.name === "ModuleScopePlugin"
  );

  if (ModuleScopePlugin) {
    // Add the direct path to react-refresh in your app's node_modules to allowedPaths.
    // This is crucial because your alias is directing it here, but CRA's scope plugin
    // might only be aware of react-scripts's internal node_modules path for react-refresh.
    ModuleScopePlugin.allowedPaths.push(
      path.resolve(__dirname, "node_modules", "react-refresh")
    );
    // Also add the specific runtime.js file path, just to be super explicit
    ModuleScopePlugin.allowedPaths.push(
      path.resolve(__dirname, "node_modules", "react-refresh", "runtime.js")
    );
  } else {
    console.warn(
      "ModuleScopePlugin not found in resolve.plugins. This might indicate an unusual CRA setup."
    );
  }

  // IMPORTANT: Remove or comment out the console.log lines for the Webpack config dump now that you have it.
  // console.log("--- STARTING WEBPACK CONFIG DUMP ---");
  // console.log(JSON.stringify(config, null, 2));
  // console.log("--- ENDING WEBPACK CONFIG DUMP ---");

  return config;
};
