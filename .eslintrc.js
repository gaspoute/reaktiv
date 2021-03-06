module.exports = {
	'env': {
		'es6': true,
		'mocha': true,
		'browser': true
  },
	'parserOptions': {
		'sourceType': 'module'
	},
	'extends': 'eslint:recommended',
	'rules': {
		'no-console': ['warn', {'allow': ['warn', 'error']}],
		'indent': ['error', 'tab'],
		'semi': ['error', 'always'],
		'no-multi-spaces': ['error'],
		'no-mixed-spaces-and-tabs': ['error'],
		'no-multiple-empty-lines': ['error'],
		'space-before-function-paren': ['error', 'never']
	}
};
