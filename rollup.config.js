import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default {
  input: 'scheduler.js',
  output: {
    file: 'bundle.js',
  },
  plugins: [resolve(), commonjs()]
}