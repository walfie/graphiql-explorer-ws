const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const webpack = require("webpack");

module.exports = (env, options) => {
  const isProd = options.mode === "production";

  const webpackConfig = {
    entry: path.join(__dirname, "src", "app.js"),
    output: {
      path: path.join(__dirname, "dist"),
      filename: "./graphiql-explorer-ws.js",
      library: "GraphiQLExplorerWs",
      libraryTarget: "umd",
    },
    devtool: false,
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                [
                  "@babel/preset-env",
                  {
                    corejs: 2,
                    loose: true,
                    modules: "commonjs",
                    useBuiltIns: "usage",
                    targets: [">0.25%", "not dead"],
                  },
                ],
                [
                  "@babel/preset-react",
                  {
                    useBuiltIns: true,
                    pragma: "React.createElement",
                    development: false,
                  },
                ],
              ],
              plugins: [
                [
                  "@babel/plugin-proposal-class-properties",
                  {
                    loose: true,
                  },
                ],
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: [{ loader: "style-loader" }, { loader: "css-loader" }],
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "src", "index.ejs"),
        filename: "index.html",
        inject: false,
      }),
      new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(options.mode),
      }),
    ],
    stats: {
      warnings: false,
    },
  };

  return webpackConfig;
};
