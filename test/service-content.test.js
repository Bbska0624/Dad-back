import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateContent} from '../src/services/content.js';
import {readFileSync} from 'node:fs';
const service={...JSON.parse(readFileSync(new URL('../src/data/services.json',import.meta.url),'utf8'))[0],publication:'published',sortOrder:0};
test('service content preserves localized data and editable image and prices',()=>{const value=validateContent('services',service);assert.equal(value.price,service.price);assert.deepEqual(value.features,service.features);assert.deepEqual(value.image,service.image);});
test('service content rejects incomplete translations and invalid images',()=>{for(const patch of [{text:{mn:'Монгол'}},{features:[{mn:'Only one language'}]},{sortOrder:-1},{price:''},{image:{src:'javascript:alert(1)'}}])assert.throws(()=>validateContent('services',{...service,...patch}));});
