const path = require('path')

module.exports = (_, argv = {}) => {
  const mode = argv.mode || process.env.NODE_ENV || 'development'
  const isProd = mode === 'production'

  return {
    mode,
    entry: './src/index.js',
    output: {
      filename: '[name].bundle.js',
      chunkFilename: '[name].bundle.js',
      path: path.resolve(__dirname, 'dist'),
    },
    devServer: {
      static: './dist',
      allowedHosts: 'all',
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpg)$/,
          use: ['file-loader'],
        },
      ],
    },
    optimization: {
      minimize: isProd,
    },
  }
}
