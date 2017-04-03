import dotProp from 'dot-prop';
import isPlainObject from 'is-plain-obj';

const {has, get} = dotProp;

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
			deep = observe(newValue);
			const subscriptions = dependency.subscriptions.filter(isActiveSubscription(dependency));
			Object.assign(dependency, {subscriptions});
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

function isActiveSubscription(dependency) {
	return subscription => subscription.dependencies.includes(dependency);
}

function notify({subscriptions}) {
	for (const subscription of subscriptions) {
		inform(subscription);
	}
}

function observe(value) {
	if ((!isPlainObject(value) && !Array.isArray(value)) || !Object.isExtensible(value)) {
		return;
	}
	if (value._dependency) {
		return value;
	}
	Object.defineProperty(value, '_dependency', {value: {subscriptions: []}});
	if (Array.isArray(value)) {
		observeEach(value);
	} else {
		for (const key of Object.keys(value)) {
			make(value, key);
		}
	}
	return value;
}

function observeEach(values) {
	for (const value of values) {
		observe(value);
	}
}

function make(object, key) {
	return typeof object[key] === 'function' ? computed(object, key) : reactive(object, key);
}

function watch(object, path, update, options = {}) {
	const {deep = false, lazy = false} = options;
	const getter = typeof path === 'function' ? path : () => get(object, path);
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
	return Object.assign(watcher, {value: lazy ? undefined : getValue(watcher, options)});
}

function getValue(watcher) {
	targets.push(watcher);
	const value = watcher.getter();
	if (watcher.deep) {
		traverse(value);
	}
	targets.pop();
	return value;
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

function teardown(watcher) {
	if (!watcher.active) {
		return;
	}
	for (const dependency of watcher.dependencies) {
		const subscriptions = dependency.subscriptions.filter(subscription => subscription !== watcher);
		Object.assign(dependency, {subscriptions});
	}
	Object.assign(watcher, {active: false});
}

export {targets, observe, watch, computed, set, unset, teardown};
