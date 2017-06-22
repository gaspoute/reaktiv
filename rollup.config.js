import node from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import buble from 'rollup-plugin-buble';

export default {
	entry: 'src/index.js',
	format: 'cjs',
	plugins: [node(), commonjs(), buble()],
	dest: 'dist/bundle.js'
};
