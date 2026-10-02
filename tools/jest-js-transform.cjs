const { transformSync } = require('esbuild');
module.exports = {
  process(source, filename) {
    return {
      code: transformSync(source, {
        loader: 'js',
        format: 'cjs',
        target: 'node22',
        sourcemap: 'inline',
        sourcefile: filename,
      }).code,
    };
  },
};
