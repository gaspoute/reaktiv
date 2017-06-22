'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var toString = Object.prototype.toString;

var index = function (x) {
	var prototype;
	return toString.call(x) === '[object Object]' && (prototype = Object.getPrototypeOf(x), prototype === null || prototype === Object.getPrototypeOf({}));
};

var index$2 = function (x) {
	var type = typeof x;
	return x !== null && (type === 'object' || type === 'function');
};

function getPathSegments(path) {
	var pathArr = path.split('.');
	var parts = [];

	for (var i = 0; i < pathArr.length; i++) {
		var p = pathArr[i];

		while (p[p.length - 1] === '\\' && pathArr[i + 1] !== undefined) {
			p = p.slice(0, -1) + '.';
			p += pathArr[++i];
		}

		parts.push(p);
	}

	return parts;
}

var index$1 = {
	get: function get(obj, path, value) {
		if (!index$2(obj) || typeof path !== 'string') {
			return value === undefined ? obj : value;
		}

		var pathArr = getPathSegments(path);

		for (var i = 0; i < pathArr.length; i++) {
			if (!Object.prototype.propertyIsEnumerable.call(obj, pathArr[i])) {
				return value;
			}

			obj = obj[pathArr[i]];

			if (obj === undefined || obj === null) {
				// `obj` is either `undefined` or `null` so we want to stop the loop, and
				// if this is not the last bit of the path, and
				// if it did't return `undefined`
				// it would return `null` if `obj` is `null`
				// but we want `get({foo: null}, 'foo.bar')` to equal `undefined`, or the supplied value, not `null`
				if (i !== pathArr.length - 1) {
					return value;
				}

				break;
			}
		}

		return obj;
	},

	set: function set(obj, path, value) {
		if (!index$2(obj) || typeof path !== 'string') {
			return;
		}

		var pathArr = getPathSegments(path);

		for (var i = 0; i < pathArr.length; i++) {
			var p = pathArr[i];

			if (!index$2(obj[p])) {
				obj[p] = {};
			}

			if (i === pathArr.length - 1) {
				obj[p] = value;
			}

			obj = obj[p];
		}
	},

	delete: function delete$1(obj, path) {
		if (!index$2(obj) || typeof path !== 'string') {
			return;
		}

		var pathArr = getPathSegments(path);

		for (var i = 0; i < pathArr.length; i++) {
			var p = pathArr[i];

			if (i === pathArr.length - 1) {
				delete obj[p];
				return;
			}

			obj = obj[p];

			if (!index$2(obj)) {
				return;
			}
		}
	},

	has: function has(obj, path) {
		if (!index$2(obj) || typeof path !== 'string') {
			return false;
		}

		var pathArr = getPathSegments(path);

		for (var i = 0; i < pathArr.length; i++) {
			if (index$2(obj)) {
				if (!(pathArr[i] in obj)) {
					return false;
				}

				obj = obj[pathArr[i]];
			} else {
				return false;
			}
		}

		return true;
	}
};

var targets = [];

function peek(stack) {
	return stack[stack.length - 1];
}

var has = index$1.has;
var get = index$1.get;
var noop = function () {};

// Inspired by Vue.js (https://vuejs.org)

function reactive(object, key, value) {
	if ( value === void 0 ) value = object[key];

	var dependency = {subscriptions: []};
	var ref = Object.getOwnPropertyDescriptor(object, key) || {};
	var getter = ref.get;
	var setter = ref.set;
	var seed = object._seed || object;
	var deep = inspect(value, {seed: seed});
	return Object.defineProperty(object, key, {
		configurable: true,
		enumerable: true,
		get: function get() {
			var target = peek(targets);
			if (target) {
				depend(dependency, target);
				if (deep) {
					depend(value._dependency, target);
				}
				if (Array.isArray(value)) {
					dependEach(value, target);
				}
			}
			return getter ? getter.call(object) : value;
		},
		set: function set(newValue) {
			var oldValue = getter ? getter.call(object) : value;
			if (newValue === oldValue) {
				return;
			}
			if (setter) {
				setter.call(object, newValue);
			} else {
				value = newValue;
			}
			deep = inspect(newValue, {seed: seed});
			notify(dependency);
		}
	});
}

function dependEach(values, watcher) {
	for (var i = 0; i < values.length; ++i) {
		var value = values[i];
		if (value && value._dependency) {
			depend(value._dependency, watcher);
		}
		if (Array.isArray(value)) {
			dependEach(value, watcher);
		}
	}
}

function depend(dependency, watcher) {
	if (!dependency.subscriptions.includes(watcher)) {
		dependency.subscriptions.push(watcher);
	}
	if (!watcher.dependencies.includes(dependency)) {
		watcher.dependencies.push(dependency);
	}
}

function notify(ref) {
	var subscriptions = ref.subscriptions;

	for (var i = 0; i < subscriptions.length; ++i) {
		inform(subscriptions[i]);
	}
}

function observe(value) {
	return inspect(value);
}

function inspect(value, options) {
	if ( options === void 0 ) options = {};

	if ((!index(value) && !Array.isArray(value)) || !Object.isExtensible(value)) {
		return;
	}
	if (value._dependency) {
		return value;
	}
	var _dependency = {subscriptions: []};
	Object.defineProperty(value, '_dependency', {value: _dependency});
	if (!options.seed && !value._watchers) {
		var _watchers = [];
		Object.defineProperty(value, '_watchers', {value: _watchers});
	}
	if (options.seed && !value._seed) {
		Object.defineProperty(value, '_seed', {value: options.seed});
	}
	if (Array.isArray(value)) {
		inspectEach(value, Object.assign(options, {seed: value}));
	} else {
		var keys = Object.keys(value);
		for (var i = 0; i < keys.length; ++i) {
			var key = keys[i];
			if (isComputed(value[key])) {
				computed(value, key);
			} else {
				reactive(value, key);
			}
		}
	}
	return value;
}

function isComputed(value) {
	return typeof value === 'function' || (index(value) && value.get);
}

function inspectEach(values, options) {
	for (var i = 0; i < values.length; ++i) {
		observe(values[i], options);
	}
}

function watch(object, path, update, options) {
	if ( options === void 0 ) options = {};

	var deep = options.deep; if ( deep === void 0 ) deep = false;
	var lazy = options.lazy; if ( lazy === void 0 ) lazy = false;
	var getter = typeof path === 'function' ? path : function () { return get(object, path); };
	var watcher = {
		update: update,
		deep: deep,
		lazy: lazy,
		active: true,
		dirty: lazy,
		dependencies: [],
		getter: getter
	};
	var seed = object._seed || object;
	seed._watchers.push(watcher);
	return Object.assign(watcher, {value: lazy ? undefined : getValue(watcher, options)});
}

function getValue(watcher) {
	var oldDependencies = [].concat( watcher.dependencies );
	watcher.dependencies.length = 0;
	targets.push(watcher);
	var value = watcher.getter();
	if (watcher.deep) {
		traverse(value);
	}
	targets.pop();
	cleanUp(watcher, oldDependencies);
	return value;
}

function cleanUp(watcher, oldDependencies) {
	var removedDependencies = oldDependencies.filter(function (oldDependency) { return !watcher.dependencies.includes(oldDependency); });
	for (var i = 0; i < removedDependencies.length; ++i) {
		var removedDependency = removedDependencies[i];
		var index$$1 = removedDependency.subscriptions.indexOf(watcher);
		removedDependency.subscriptions.splice(index$$1, 1);
	}
}

function traverse(value, seen) {
	if ( seen === void 0 ) seen = [];

	if ((!index(value) && !Array.isArray(value)) || !Object.isExtensible(value)) {
		return;
	}
	if (value._dependency) {
		if (seen.includes(value._dependency)) {
			return;
		}
		seen.push(value._dependency);
	}
	if (Array.isArray(value)) {
		traverseEach(value, seen);
	} else {
		var keys = Object.keys(value);
		for (var i = 0; i < keys.length; ++i) {
			traverse(value[keys[i]], seen);
		}
	}
}

function traverseEach(values, seen) {
	for (var i = 0; i < values.length; ++i) {
		traverse(values[i], seen);
	}
}

function inform(watcher) {
	var oldValue = watcher.value;
	if (watcher.lazy) {
		watcher.dirty = true;
	} else if (watcher.active) {
		var value = getValue(watcher);
		if (oldValue !== value || index(value) || watcher.deep) {
			watcher.value = value;
			watcher.update(value, oldValue);
		}
	}
}

function evaluate(watcher) {
	watcher.dirty = false;
	watcher.value = getValue(watcher);
}

function computed(object, key) {
	var compute = typeof object[key] === 'function' ? object[key] : object[key].get;
	var watcher = watch(object, compute, noop, {lazy: true});
	return Object.defineProperty(object, key, {
		configurable: true,
		enumerable: true,
		get: function get() {
			if (watcher.dirty) {
				evaluate(watcher);
			}
			var target = peek(targets);
			if (target) {
				for (var i = 0; i < watcher.dependencies.length; ++i) {
					depend(watcher.dependencies[i], target);
				}
			}
			return watcher.value;
		},
		set: typeof object[key] === 'function' ? noop : (object[key].set || noop)
	});
}

function set(object, key, value) {
	if (has(object, key)) {
		object[key] = value;
		return value;
	}
	if (!object._dependency) {
		object[key] = value;
		return value;
	}
	reactive(object, key, value);
	notify(object._dependency);
	return value;
}

function unset(object, key) {
	if (!has(object, key)) {
		return;
	}
	delete object[key];
	if (!object._dependency) {
		return;
	}
	notify(object._dependency);
}

function ignore(watcher) {
	if (!watcher.active) {
		return;
	}
	for (var i = 0; i < watcher.dependencies.length; ++i) {
		var dependency = watcher.dependencies[i];
		dependency.subscriptions = dependency.subscriptions.filter(function (subscription) { return subscription !== watcher; });
	}
	watcher.active = false;
}

exports.observe = observe;
exports.watch = watch;
exports.ignore = ignore;
exports.set = set;
exports.unset = unset;
