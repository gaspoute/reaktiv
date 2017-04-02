import {has, get} from 'dot-prop';
import isPlainObject from 'is-plain-obj';
import s from 'spots';

// Inspired by Vue.js (https://vuejs.org).

const targets = [];

function peek(stack) {
	return stack[stack.length - 1];
}

function reactive(object, key, value = object[key]) {
	const dependency = {subscriptions: []}; // The watchers that depend on me.
	const {get: getter, set: setter} = Object.getOwnPropertyDescriptor(object, key) || {};
	let deep = observe(value);
	return Object.defineProperty(object, key, {
		configurable: true,
		enumerable: true,
		get() {
			const target = peek(targets);
			if (target) {
				depend(dependency, target);
				if (deep) {
					depend(deep.dependency, target);
				}
				if (Array.isArray(value)) {
					dependEach(value, target);
				}
			}
			return getter ? getter.call(object) : value;
		},
		set(newValue) {
			const {subscriptions} = dependency
			if (setter) {
				setter.call(object, newValue);
			} else {
				value = newValue;
			}
			deep = observe(newValue);
			Object.assign(dependency, {
				subscriptions: subscriptions.filter(isActiveSubscription(dependency))
			});
			notify(dependency);
		}
	});
}

function dependEach(values, watcher) {
	for (let i = 0; i < values.length; ++i) {
		const value = values[i];
		const {dependency} = value;
		if (dependency) {
			depend(dependency, watcher);
		}
		if (Array.isArray(value)) {
			dependEach(value, watcher);
		}
	}
}

function depend(dependency, watcher) {
	const {subscriptions} = dependency;
	if (!subscriptions.includes(watcher)) {
		subscriptions.push(watcher);
	}
	const {dependencies} = watcher;
	if (!dependencies.includes(dependency)) {
		dependencies.push(dependency);
	}
}

function isActiveSubscription(dependency) {
	return subscription => {
		const {dependencies} = subscription;
		return dependencies.includes(dependency);
	};
}

function notify(dependency) {
	const {subscriptions} = dependency;
	for (const subscription of subscriptions) {
		inform(subscription);
	}
}

function observe(value) {
	if ((!isPlainObject(value) && !Array.isArray(value)) || !Object.isExtensible(value)) {
		return;
	}
	if (has(value, 'dependency')) {
		return value;
	}
	const dependency = {subscriptions: []};
	Object.defineProperty(value, 'dependency', {
		value: dependency
	});
	if (Array.isArray(value)) {
		observeEach(value);
	} else {
		const keys = Object.keys(value);
		for (const key of keys) {
			make(value, key, value[key]);
		}
	}
	return value;
}

function observeEach(values) {
	for (let i = 0; i < values.length; ++i) {
		observe(values[i]);
	}
}

function make(object, key, value) {
	if (typeof value === 'function') {
		return computed(object, key);
	}
	return reactive(object, key);
}

function watch(object, path, update, options = {}) {
	const {
		deep = false,
		lazy = false
	} = options;
	const getter = typeof path === 'function' ? path : s(get, object, path);
	const watcher = {
		object,
		getter,
		update,
		deep,
		lazy,
		active: true,
		dirty: lazy,
		dependencies: [] // The properties the watcher is depending on.
	};
	return Object.assign(watcher, {
		value: lazy ? undefined : getValue(watcher, options)
	});
}

function getValue(watcher) {
	const {getter, deep} = watcher;
	targets.push(watcher);
	const value = getter();
	if (deep) {
		traverse(value);
	}
	targets.pop();
	return value;
}

function traverse(value, seen = []) {
	if ((!isPlainObject(value) && !Array.isArray(value)) || !Object.isExtensible(value)) {
		return;
	}
	const {dependency} = value;
	if (dependency) {
		if (seen.includes(dependency)) {
			return;
		}
		seen.push(dependency);
	}
	if (Array.isArray(value)) {
		traverseEach(value, seen);
	} else {
		const keys = Object.keys(value);
		for (const key of keys) {
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
	const {update, active, deep, lazy, value: oldValue} = watcher;
	if (lazy) {
		Object.assign(watcher, {
			dirty: true
		});
	} else if (active) {
		const value = getValue(watcher);
		if (oldValue !== value || isPlainObject(value) || deep) {
			Object.assign(watcher, {value});
			update(value, oldValue);
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
			const {dirty, dependencies} = watcher;
			if (dirty) {
				evaluate(watcher);
			}
			const target = peek(targets);
			if (target) {
				for (const dependency of dependencies) {
					depend(dependency, target);
				}
			}
			const {value} = watcher;
			return value;
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
	const {dependency} = object;
	if (!dependency) {
		object[key] = value;
		return value;
	}
	reactive(object, key, value);
	notify(dependency);
	return value;
}

function unset(object, key) {
	if (!has(object, key)) {
		return;
	}
	delete object[key];
	const {dependency} = object;
	if (!dependency) {
		return;
	}
	notify(dependency);
}

 function teardown(watcher) {
	const {active, dependencies} = watcher;
	if (!active) {
		return;
	}
	for (const dependency of dependencies) {
		const {subscriptions} = dependency;
		Object.assign(dependency, {
			subscriptions: subscriptions.filter(subscription => subscription !== watcher)
		});
	}
	Object.assign(watcher, {
		active: false
	});
}

export {targets, observe, watch, computed, set, unset, teardown};
