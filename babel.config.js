module.exports = {
  presets: [
    ['next/babel', {
      'preset-typescript': {
        allowDeclareFields: true
      }
    }]
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }]
  ]
};