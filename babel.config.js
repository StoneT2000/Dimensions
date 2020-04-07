module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current',
        "esmodules": true
      },
      modules: "commonjs"
    }],
    '@babel/preset-typescript',

  ],
};