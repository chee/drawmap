module.exports = {
  files: {
    javascripts: {
      joinTo: {
        'vendor.js': /^(?!app)/,
        'app.js': /^app/
      }
    },
    stylesheets: {joinTo: 'app.css'}
  },
  plugins: {
    babel: {presets: ['stage-0', 'es2015']},
    sass: {modules: true}
  },
  server: {
    hostname: '0.0.0.0'
  }
};
