const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    target: "web",
    entry: {
        main: "./src/index.tsx",
        hub: "./src/hub.tsx",
        action: "./src/action.tsx",
        settings: "./src/settings.tsx"
    },
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "dist"),
        clean: true
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"]
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            },
            {
                test: /\.(woff|woff2|eot|ttf|otf|svg)$/i,
                type: 'asset/resource',
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: "index.html",
            template: "./src/index.html",
            chunks: ["main"]
        }),
        new HtmlWebpackPlugin({
            filename: "hub.html",
            template: "./src/hub.html",
            chunks: ["hub"]
        }),
        new HtmlWebpackPlugin({
            filename: "action.html",
            template: "./src/action.html",
            chunks: ["action"]
        }),
        new HtmlWebpackPlugin({
            filename: "settings.html",
            template: "./src/settings.html",
            chunks: ["settings"]
        })
    ],
    optimization: {
        splitChunks: {
            chunks: "all"
        }
    },
    performance: {
        maxAssetSize: 5242880, // 5 MiB
        maxEntrypointSize: 5242880, // 5 MiB
        assetFilter: function(assetFilename) {
            return !assetFilename.endsWith('.woff2');
        }
    }
};
