import isPlainObject from 'is-plain-obj';
import dotProp from 'dot-prop';

const {has, get} = dotProp;

// Inspired by Vue.js (https://vuejs.org)

const targets = [];

function peek(stack) {
	return stack[stack.length - 1];
}

function reactive(object, key, value = object[key]) {
	const dependency = {subscriptions: []};
	const {get: getter, set: setter} = Object.getOwnPropertyDescriptor(object, key) || {};
	const seed = object._seed || object;
	let deep = inspect(value, {seed});
	return Object.defineProperty(object, key, {
		configurable: true,
		enumerable: true,
		get() {
			const target = peek(targets);
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
		set(newValue) {
			if (setter) {
				setter.call(object, newValue);
			} else {
				value = newValue;
			}
			deep = inspect(newValue, {seed});
			notify(dependency);
		}
	});
}

function dependEach(values, watcher) {
	for (const value of values) {
		if (value._dependency) {
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

function notify({subscriptions}) {
	for (const subscription of subscriptions) {
		inform(subscription);
	}
}

function observe(value) {
	return inspect(value);
}

function inspect(value, options = {}) {
	if ((!isPlainObject(value) && !Array.isArray(value)) || !Object.isExtensible(value)) {
		return;
	}
	if (value._dependency) {
		return value;
	}
	const {seed} = options;
	const _dependency = {subscriptions: []};
	Object.defineProperty(value, '_dependency', {value: _dependency});
	if (!seed && !value._watchers) {
		const _watchers = [];
		Object.defineProperty(value, '_watchers', {value: _watchers});
	}
	if (seed && !value._seed) {
		Object.defineProperty(value, '_seed', {value: seed});
	}
	if (Array.isArray(value)) {
		inspectEach(value, options);
	} else {
		for (const key of Object.keys(value)) {
			if (typeof value[key] === 'function') {
				computed(value, key);
			} else {
				reactive(value, key);
			}
		}
	}
	return value;
}

function inspectEach(values, options) {
	for (const value of values) {
		observe(value, options);
	}
}

function watch(object, path, update, options = {}) {
	const {deep = false, lazy = false} = options;
	const getter = typeof path === 'function' ? path : () => get(object, path);
	const watcher = {
		update,
		deep,
		lazy,
		active: true,
		dirty: lazy,
		dependencies: [],
		getter
	};
	const seed = object._seed || object;
	seed._watchers.push(watcher);
	return Object.assign(watcher, {value: lazy ? undefined : getValue(watcher, options)});
}

function getValue(watcher) {
	targets.push(watcher);
	const oldDependencies = [...watcher.dependencies];
	watcher.dependencies.length = 0;
	const value = watcher.getter();
	if (watcher.deep) {
		traverse(value);
	}
	cleanUp(watcher, oldDependencies);
	targets.pop();
	return value;
}

function cleanUp(watcher, oldDependencies) {
	const removedDependencies = oldDependencies.filter(oldDependency => !watcher.dependencies.includes(oldDependency));
	for (const removedDependency of removedDependencies) {
		const index = removedDependency.subscriptions.indexOf(watcher);
		const subscriptions = [
			...removedDependency.subscriptions.slice(0, index),
			...removedDependency.subscriptions.slice(index + 1)
		];
		Object.assign(removedDependency, {subscriptions});
	}

}

function traverse(value, seen = []) {
	if ((!isPlainObject(value) && !Array.isArray(value)) || !Object.isExtensible(value)) {
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
		for (const key of Object.keys(value)) {
			traverse(value[key], seen);
		}
	}
}

function traverseEach(values, seen) {
	for (const value of values) {
		traverse(value, seen);
	}
}

function inform(watcher) {
	const {value: oldValue} = watcher;
	if (watcher.lazy) {
		Object.assign(watcher, {dirty: true});
	} else if (watcher.active) {
		const value = getValue(watcher);
		if (oldValue !== value || isPlainObject(value) || watcher.deep) {
			Object.assign(watcher, {value});
			watcher.update(value, oldValue);
		}
	}
}

function evaluate(watcher) {
	Object.assign(watcher, {
		dirty: false,
		value: getValue(watcher)
	});
}

function computed(object, key) {
	const compute = object[key];
	const watcher = watch(object, compute, () => {}, {lazy: true});
	return Object.defineProperty(object, key, {
		configurable: true,
		enumerable: true,
		get() {
			if (watcher.dirty) {
				evaluate(watcher);
			}
			const target = peek(targets);
			if (target) {
				for (const dependency of watcher.dependencies) {
					depend(dependency, target);
				}
			}
			return watcher.value;
		},
		set() {
			// Nothing to do !
		}
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
	if (!object._seed) { // Cannot set a new property to a seed
		console.warn('Cannot set a new property to a seed');
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
	if (!object._seed) {
		console.warn('Cannot delete a property from a seed');
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
	for (const dependency of watcher.dependencies) {
		const subscriptions = dependency.subscriptions.filter(subscription => subscription !== watcher);
		Object.assign(dependency, {subscriptions});
	}
	Object.assign(watcher, {active: false});
}

export {targets, observe, watch, ignore, set, unset};
