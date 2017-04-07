import {expect} from 'chai';
import {spy} from 'sinon';
import {targets, observe, watch, ignore, set, unset} from './index';
import dotProp from 'dot-prop';

const {has, get} = dotProp;

function mock(object, path, update = spy(), options = {}) {
	const {deep = false} = options;
	const getter = () => get(object, path);
	return {
		update,
		deep,
		lazy: false,
		active: true,
		dirty: false,
		dependencies: [],
		getter,
		value: getter()
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
		expect(observed1._dependency).to.exist;
		expect(observed1.a._dependency).to.exist;
		expect(observed1.b._dependency).to.exist;
		const observed2 = observe(object);
		expect(observed2).to.equal(observed1);
	});
	it('should observe an object created using `Object.create`', () => {
		const object = Object.create(null);
		object.a = {};
		object.b = {};
		const observed1 = observe(object)
		expect(observed1._dependency).to.exist;
		expect(object.a._dependency).to.exist;
		expect(object.b._dependency).to.exist;
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
				count++;
				return value;
			},
			set(newValue) {
				value = newValue;
			}
		});
		const observed1 = observe(object);
		expect(observed1._dependency).to.exist;
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
	it('should observe a property with only a getter', () => {
		const object = {};
		Object.defineProperty(object, 'a', {
			configurable: true,
			enumerable: true,
			get() {
				return 123;
			}
		});
		const observed1 = observe(object);
		expect(observed1._dependency).to.exist;
		expect(object.a).to.equal(123);
		const observed2 = observe(object);
		expect(observed2).to.equal(observed1);
		object.a = 101;
		expect(object.a).to.equal(123);
	});
	it('should observe a property with only a setter', () => {
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
		expect(observed1._dependency).to.exist;
		expect(object.a).to.be.undefined;
		const observed2 = observe(object);
		expect(observed2).to.equal(observed1);
		object.a = 100;
		expect(value).to.equal(100);
	});
	it('should observe an array', () => {
		const array = [{}, {}];
		const observed1 = observe(array);
		expect(observed1._dependency).to.exist;
		expect(array[0]._dependency).to.exist;
		expect(array[1]._dependency).to.exist;
	});
	it('should observe an object property change', () => {
		const object = {a: {b: 2}, c: NaN};
		observe(object);
		const watcher = mock(object, 'a.b');
		targets.push(watcher);
		get(object, 'a.b');
		targets.pop();
		expect(watcher.dependencies.length).to.equal(3); // Why ? object.a + a + a.b.
		object.a.b = 3;
		expect(watcher.update.callCount).to.equal(1);
		object.a = {b: 4};
		expect(watcher.update.callCount).to.equal(2);
		watcher.dependencies = [];
		targets.push(watcher);
		get(object, 'a.b');
		get(object, 'c');
		targets.pop();
		expect(watcher.dependencies.length).to.equal(4);
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
		expect(object.a).to.equal(2); // Make sure 'this' is preserved.
		targets.pop();
		object.a = 3;
		expect(object.value).to.equal(3); // Make sure 'setter' was called.
		object.value = 5;
		expect(object.a).to.equal(5); // Make sure 'getter' was called.
	});
	it('should observe a set/deleted object property', () => {
		const object1 = {
			data: {
				a: {b: 1}
			}
		};
		observe(object1);
		const watcher1 = mock(object1, 'data');
		targets.push(watcher1);
		get(object1, 'data');
		targets.pop();
		set(object1.data, 'b', 2);
		expect(object1.data.b).to.equal(2);
		expect(watcher1.update.callCount).to.equal(1);
		unset(object1.data, 'a');
		expect(has(object1.data, 'a')).to.be.false;
		expect(watcher1.update.callCount).to.equal(2);
		// Set an existing property.
		set(object1.data, 'b', 3);
		expect(object1.data.b).to.equal(3);
		expect(watcher1.update.callCount).to.equal(2);
		// Set a nonexistent property.
		set(object1.data, 'c', 1);
		expect(object1.data.c).to.equal(1);
		expect(watcher1.update.callCount).to.equal(3);
		// Should ignore the deletion of a nonexistent property.
		unset(object1.data, 'a');
		expect(watcher1.update.callCount).to.equal(3);
		// Should set/delete a property of a non-observed object.
		const object2 = {a: 1};
		set(object2, 'b', 2);
		expect(object2.b).to.equal(2);
		unset(object2, 'a');
		expect(has(object2, 'a')).to.be.false;
	});
});
describe('watch', () => {
	let data;
	let update;
	beforeEach(() => {
		data = {
			a: 1,
			b: {
				c: 2,
				d: 4
			},
			e() {
				return data.a + data.b.c;
			},
			f: [[]]
		};
		update = spy();
		observe(data);
	});
	it('should watch a property', () => {
		const watcher = watch(data, 'b.c', update);
		expect(watcher.value).to.equal(2);
		data.b.c = 3;
		expect(watcher.value).to.equal(3);
		expect(update.calledWith(3, 2)).to.be.true;
		data.b = {c: 4};
		expect(watcher.value).to.equal(4);
		expect(update.calledWith(4, 3)).to.be.true;
	});
	it('should watch a nonexistent property, set later', () => {
		const watcher = watch(data, 'b.e', update);
		expect(watcher.value).to.be.undefined;
		set(data.b, 'e', 123);
		expect(watcher.value).to.equal(123);
		expect(update.called).to.be.true;
		expect(update.calledWith(123, undefined)).to.be.true;
	});
	it('should delete a watched property', () => {
		const watcher = watch(data, 'b.c', update);
		expect(watcher.value).to.equal(2);
		unset(data.b, 'c');
		expect(watcher.value).to.be.undefined;
		expect(update.calledWith(undefined, 2)).to.be.true;
	});
	it('should deeply watch a property', () => {
		watch(data, 'b', update, {deep: true});
		const oldB = data.b;
		data.b.c = {d: 4};
		expect(update.calledWith(data.b, data.b)).to.be.true;
		data.b = {c: [{a: 1}]};
		expect(update.calledWith(data.b, oldB)).to.be.true;
		expect(update.callCount).to.equal(2);
		data.b.c[0].a = 2;
		expect(update.calledWith(data.b, data.b)).to.be.true;
		expect(update.callCount).to.equal(3);
	});
	it('should deeply watch a property with circular references', () => {
		watch(data, 'b', update, {deep: true});
		set(data.b, '_', data.b);
		expect(update.calledWith(data.b, data.b)).to.be.true;
		expect(update.callCount).to.equal(1);
		data.b._.c = 1;
		expect(update.calledWith(data.b, data.b)).to.be.true;
		expect(update.callCount).to.equal(2);
	});
	it('should inform of the change a non-deep watcher when adding/deleting a property', () => {
		watch(data, 'b', update);
		set(data.b, 'e', 123);
		expect(update.calledWith(data.b, data.b)).to.be.true;
		expect(update.callCount).to.equal(1);
		unset(data.b, 'e');
		expect(update.callCount).to.equal(2);
	});
	it('should watch a computed property', () => {
		const watcher = watch(data, () => {
			return data.a + data.b.d;
		}, update);
		expect(watcher.value).to.equal(5);
		data.a = 2;
		expect(update.calledWith(6, 5)).to.be.true;
		data.b = {d: 2};
		expect(update.calledWith(4, 6)).to.be.true;
	});
	it('should inform of the change a deep watcher when adding/deleting a element to/from an array', () => {
		watch(data, 'f', update, {deep: true});
		const element = {a: 1};
		data.f = data.f.concat(element);
		expect(data.f[1]).to.equal(element);
		expect(update.callCount).to.equal(1);
		data.f[1].a = {b: 2};
		expect(data.f[1].a.b).to.equal(2);
		expect(update.callCount).to.equal(2);
		data.f = [
			[2],
			...data.f.slice(1)
		];
		expect(data.f[0][0]).to.equal(2);
		expect(update.callCount).to.equal(3);
		data.f = [];
		expect(data.f).to.be.empty;
		expect(update.callCount).to.equal(4);
	});
	it('should tear down a watcher', () => {
		const watcher = watch(data, 'b.c', update);
		data.b.c = 3;
		expect(watcher.active).to.be.true;
		expect(update.callCount).to.equal(1);
		ignore(watcher);
		expect(watcher.active).to.be.false;
		expect(update.callCount).to.equal(1);
	});
	it('should tear down an inactive watcher', () => {
		const watcher = watch(data, 'b.c', update);
		ignore(watcher);
		expect(watcher.active).to.be.false;
		ignore(watcher);
		expect(watcher.active).to.be.false;
		expect(update.notCalled).to.be.true;
	});
	it('should compute an object property', () => {
		expect(data.a).to.equal(1);
		expect(data.b.c).to.equal(2);
		expect(data.e).to.equal(3);
		data.a = 3;
		expect(data.a).to.equal(3);
		expect(data.e).to.equal(5);
	});
	it('should watch a computed object property', () => {
		const watcher = watch(data, 'e', update);
		expect(watcher.value).to.equal(3);
		data.a = 3;
		expect(update.calledWith(5, 3)).to.be.true;
		data.b = {c: 4};
		expect(update.calledWith(7, 5)).to.be.true;
	});
});
