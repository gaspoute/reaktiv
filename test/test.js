import {expect} from 'chai';
import {spy} from 'sinon';
import {targets} from '../src/targets';
import {observe, watch, ignore, set, unset} from '../src';
import dotProp from 'dot-prop';

const {get} = dotProp;

function mock(object, path) {
	return {
		update: spy(),
		deep: false,
		lazy: false,
		active: true,
		dirty: false,
		dependencies: [],
		getter() {
			return get(object, path);
		},
		value: get(object, path)
	};
}

describe('observe', () => {
	it('should not observe non-observables', () => {
		const observed1 = observe(1);
		expect(observed1).to.be.undefined;
		const observed2 = observe(Object.freeze({}));
		expect(observed2).to.be.undefined;
	});
	it('should observe an object', () => {
		const object = {
			a: {},
			b: {}
		};
		const observed1 = observe(object);
		expect(observed1).to.have.property('_dependency');
		expect(observed1.a).to.have.property('_dependency');
		expect(observed1.b).to.have.property('_dependency');
		const observed2 = observe(object);
		expect(observed2).to.equal(observed1);
	});
	it('should observe a `null` object', () => {
		const object = Object.create(null);
		object.a = {};
		object.b = {};
		const observed1 = observe(object);
		expect(observed1).to.have.property('_dependency');
		expect(object.a).to.have.property('_dependency');
		expect(object.b).to.have.property('_dependency');
		const observed2 = observe(object);
		expect(observed2).to.equal(observed1);
	});
	it('should observe an already observed object', () => {
		const object = {};
		let value = 0;
		let count = 0;
		Object.defineProperty(object, 'a', {
			configurable: true,
			enumerable: true,
			get() {
				++count;
				return value;
			},
			set(newValue) {
				value = newValue;
			}
		});
		const observed1 = observe(object);
		expect(observed1).to.have.property('_dependency');
		count = 0;
		get(object, 'a');
		expect(count).to.equal(1);
		get(object, 'a');
		expect(count).to.equal(2);
		const observed2 = observe(object);
		expect(observed2).to.equal(observed1);
		object.a = 10;
		expect(value).to.equal(10);
	});
	it('should observe a object property with only a getter', () => {
		const object = {};
		Object.defineProperty(object, 'a', {
			configurable: true,
			enumerable: true,
			get() {
				return 123;
			}
		});
		const observed1 = observe(object);
		expect(observed1).to.have.property('_dependency');
		expect(object).to.have.property('a', 123);
		const observed2 = observe(object);
		expect(observed2).to.equal(observed1);
		object.a = 101;
		expect(object).to.have.property('a', 123);
	});
	it('should observe a object property with only a setter', () => {
		const object = {};
		let value = 10;
		Object.defineProperty(object, 'a', {
			configurable: true,
			enumerable: true,
			set(newValue) {
				value = newValue;
			}
		});
		const observed1 = observe(object);
		expect(observed1).to.have.property('_dependency');
		expect(object).to.have.property('a').and.be.undefined;
		const observed2 = observe(object);
		expect(observed2).to.equal(observed1);
		object.a = 100;
		expect(value).to.equal(100);
	});
	it('should observe an array', () => {
		const array = [{}, {}];
		const observed1 = observe(array);
		expect(observed1).to.have.property('_dependency');
		expect(array[0]).to.have.property('_dependency');
		expect(array[1]).to.have.property('_dependency');
	});
	it('should observe an object property change', () => {
		const object = {
			a: {
				b: 2
			},
			c: NaN
		};
		observe(object);
		const watcher = mock(object, 'a.b');
		targets.push(watcher);
		get(object, 'a.b');
		targets.pop();
		expect(watcher.dependencies).to.have.lengthOf(3); // Why ? object.a + a + a.b
		object.a.b = 3;
		expect(watcher.update.callCount).to.equal(1);
		object.a = {b: 4};
		expect(watcher.update.callCount).to.equal(2);
		watcher.dependencies = [];
		targets.push(watcher);
		get(object, 'a.b');
		get(object, 'c');
		targets.pop();
		expect(watcher.dependencies).to.have.lengthOf(4);
		object.a.b = 5;
		expect(watcher.update.callCount).to.equal(3);
		object.c = NaN;
		expect(watcher.update.callCount).to.equal(3);
	});
	it('should observe a defined object property change', () => {
		const object = {value: 2};
		Object.defineProperty(object, 'a', {
			configurable: true,
			enumerable: true,
			get() {
				return this.value;
			},
			set(newValue) {
				this.value = newValue;
				return this.value;
			}
		});
		observe(object);
		const watcher = mock(object, 'a');
		targets.push(watcher);
		expect(object).to.have.property('a', 2);
		targets.pop();
		object.a = 3;
		expect(object.value).to.equal(3);
		object.value = 5;
		expect(object).to.have.property('a', 5);
	});
});
describe('set/unset', () => {
	let object;
	let watcher;
	beforeEach(() => {
		object = {
			a: {
				b: 1,
				c: 2
			}
		};
		observe(object);
		watcher = mock(object, 'a');
		targets.push(watcher);
		get(object, 'a');
		targets.pop();
	});
	it('should observe a set/unset object property', () => {
		set(object.a, 'd', 3);
		expect(object.a).to.have.property('d', 3);
		expect(watcher.update.callCount).to.equal(1);
		unset(object.a, 'b');
		expect(object.a).to.not.have.property('b');
		expect(watcher.update.callCount).to.equal(2);
	});
	it('should set an existing object property', () => {
		set(object.a, 'b', 4);
		expect(object.a).to.have.property('b', 4);
		expect(watcher.update.called).to.be.false;
	});
	it('should set a nonexistent object property', () => {
		set(object.a, 'e', 5);
		expect(object.a).to.have.property('e', 5);
		expect(watcher.update.called).to.be.true;
	});
	it('should ignore the deletion of a nonexistent object property', () => {
		unset(object.a, 'f');
		expect(watcher.update.called).to.be.false;
	});
	it('should set/unset a property of a non-observed object', () => {
		const unobserved = {a: 1};
		set(unobserved, 'b', 2);
		expect(unobserved).to.have.property('b', 2);
		unset(unobserved, 'a');
		expect(unobserved).to.not.have.property('a');
	});
});
describe('watch/ignore', () => {
	let object;
	beforeEach(() => {
		object = {
			a: 1,
			b: {
				c: 2,
				d: 4
			},
			e() {
				return object.a + object.b.c;
			},
			f: [[]],
			g: {
				get() {
					return object.a * object.b.c;
				},
				set(value) {
					object.a = value / object.b.c;
					object.b.c = value / object.a;
				}
			},
			h: {
				get() {
					return object.a + object.b.c;
				}
			}
		};
		observe(object);
	});
	it('should watch an object property', () => {
		const watcher = watch(object, 'b.c', spy());
		expect(watcher.value).to.equal(2);
		object.b.c = 3;
		expect(watcher.value).to.equal(3);
		expect(watcher.update.calledWith(3, 2)).to.be.true;
		object.b = {c: 4};
		expect(watcher.value).to.equal(4);
		expect(watcher.update.calledWith(4, 3)).to.be.true;
	});
	it('should watch a nonexistent object property, set later', () => {
		const watcher = watch(object, 'b.e', spy());
		expect(watcher.value).to.be.undefined;
		set(object.b, 'e', 123);
		expect(watcher.value).to.equal(123);
		expect(watcher.update.calledWith(123, undefined)).to.be.true;
	});
	it('should unset a watched object property', () => {
		const watcher = watch(object, 'b.c', spy());
		expect(watcher.value).to.equal(2);
		unset(object.b, 'c');
		expect(watcher.value).to.be.undefined;
		expect(watcher.update.calledWith(undefined, 2)).to.be.true;
	});
	it('should deeply watch an object property', () => {
		const watcher = watch(object, 'b', spy(), {deep: true});
		const oldB = object.b;
		object.b.c = {d: 4};
		expect(watcher.update.calledWith(object.b, object.b)).to.be.true;
		object.b = {
			c: [{a: 1}]
		};
		expect(watcher.update.calledWith(object.b, oldB)).to.be.true;
		expect(watcher.update.callCount).to.equal(2);
		object.b.c[0].a = 2;
		expect(watcher.update.calledWith(object.b, object.b)).to.be.true;
		expect(watcher.update.callCount).to.equal(3);
	});
	it('should deeply watch an object property with circular references', () => {
		const watcher = watch(object, 'b', spy(), {deep: true});
		set(object.b, '_', object.b);
		expect(watcher.update.calledWith(object.b, object.b)).to.be.true;
		expect(watcher.update.callCount).to.equal(1);
		object.b._.c = 1;
		expect(watcher.update.calledWith(object.b, object.b)).to.be.true;
		expect(watcher.update.callCount).to.equal(2);
	});
	it('should inform about the change a non-deep watcher when setting/unsetting an object property', () => {
		const watcher = watch(object, 'b', spy());
		set(object.b, 'e', 123);
		expect(watcher.update.calledWith(object.b, object.b)).to.be.true;
		expect(watcher.update.callCount).to.equal(1);
		unset(object.b, 'e');
		expect(watcher.update.callCount).to.equal(2);
	});
	it('should watch a computed property', () => {
		const watcher = watch(object, () => {
			return object.a + object.b.d;
		}, spy());
		expect(watcher.value).to.equal(5);
		object.a = 2;
		expect(watcher.update.calledWith(6, 5)).to.be.true;
		object.b = {d: 2};
		expect(watcher.update.calledWith(4, 6)).to.be.true;
	});
	it('should inform about the change a deep watcher when setting/unsetting an element to/from an array', () => {
		const watcher = watch(object, 'f', spy(), {deep: true});
		const element = {a: 1};
		object.f = object.f.concat(element);
		expect(object.f[1]).to.equal(element);
		expect(watcher.update.callCount).to.equal(1);
		const nested = {b: 2};
		object.f[1].a = nested;
		expect(object.f[1]).to.have.property('a', nested);
		expect(watcher.update.callCount).to.equal(2);
		object.f = [
			[2],
			...object.f.slice(1)
		];
		expect(object.f[0][0]).to.equal(2);
		expect(watcher.update.callCount).to.equal(3);
		object.f = [];
		expect(object.f).to.be.empty;
		expect(watcher.update.callCount).to.equal(4);
	});
	it('should ignore a watcher', () => {
		const watcher = watch(object, 'b.c', spy());
		object.b.c = 3;
		expect(watcher.active).to.be.true;
		expect(watcher.update.callCount).to.equal(1);
		ignore(watcher);
		expect(watcher.active).to.be.false;
		expect(watcher.update.callCount).to.equal(1);
	});
	it('should ignore an inactive watcher', () => {
		const watcher = watch(object, 'b.c', spy());
		ignore(watcher);
		expect(watcher.active).to.be.false;
		ignore(watcher);
		expect(watcher.active).to.be.false;
		expect(watcher.update.notCalled).to.be.true;
	});
	it('should compute an object property', () => {
		expect(object).to.have.property('a', 1);
		expect(object.b).to.have.property('c', 2);
		expect(object).to.have.property('e', 3);
		object.a = 3;
		expect(object).to.have.property('a', 3);
		expect(object).to.have.property('e', 5);
	});
	it('should watch a computed property', () => {
		const watcher = watch(object, 'e', spy());
		expect(watcher.value).to.equal(3);
		object.a = 3;
		expect(watcher.update.calledWith(5, 3)).to.be.true;
		object.b = {c: 4};
		expect(watcher.update.calledWith(7, 5)).to.be.true;
	});
	it('should not inform about the change a watcher when setting the same value to an object property', () => {
		const watcher1 = watch(object, 'a', spy());
		expect(watcher1.value).to.equal(1);
		object.a = 1;
		expect(watcher1.update.notCalled).to.be.true;
		const watcher2 = watch(object, 'b', spy());
		object.b = object.b;
		expect(watcher2.update.notCalled).to.be.true;
	});
	it('should set computed property', () => {
		expect(object).to.have.property('a', 1);
		expect(object.b).to.have.property('c', 2);
		expect(object).to.have.property('g', 2);
		object.g = 4;
		expect(object).to.have.property('a', 2);
		expect(object.b).to.have.property('c', 2);
	});
	it('should compute an object property with only a getter', () => {
		expect(object).to.have.property('a', 1);
		expect(object.b).to.have.property('c', 2);
		expect(object).to.have.property('h', 3);
		object.a = 3;
		expect(object).to.have.property('a', 3);
		expect(object).to.have.property('h', 5);
	});
});
