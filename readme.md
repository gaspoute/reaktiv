# Reaktiv

> Watchers and computed properties (inspired by [Vue.js](https://vuejs.org))

## Usage
```javascript
import {observe, set, unset, watch, ignore} from 'reaktiv';

const data = {
  person: {
		firstName: 'Bar',
		lastName: 'Foo',
		fullName() {
			return `${data.person.firstName} ${data.person.lastName}`;
		}
	}
};

observe(data);

console.log(data.person.fullName) // 'Bar Foo'

const watcher = watch(data.person, 'fullName', value => {
  console.log(value); // 'Baz Foo'
});

data.person.firstName = 'Baz';

set(data.person, 'age', 34); // Add a new property to the object

console.log(data.person.age); // 34

unset(data.person, 'age'); // Delete a property

console.log(data.person.age); // undefined

ignore(watcher); // Unsubscribe the watcher from all its dependencies
```
## API
### observe(object)
Makes reactive all properties of an object.

### set(object, key, value)
Adds a new property to an object and notifies watchers if the property doesn't already exist.

### unset(object, key)
Deletes a property from an object and notifies watchers.

### watch(object, path, callback, [options])
Returns a watcher that watches a property of an object.

#### object
Type: `Object`

Object to watch the property.

#### path
Type: `String`

Path of the watched property in the object.

#### callback
Type: `Function`

Called when the value of the watched property has changed.

#### options
Type: `Object`

##### deep
Type: `boolean`
Default: `false`

Deeply watch the property of the object.

### ignore(watcher)
Unsubscribe a watcher from all its dependencies.
