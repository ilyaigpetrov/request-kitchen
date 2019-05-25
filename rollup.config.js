export default [
  {
    input: './node_modules/@bexer/components/esm/index.js',
    output: {
      file: './dist/vendor/bexer/index.js',
      format: 'iife',
      name: 'Bexer',
    },
  },
];
