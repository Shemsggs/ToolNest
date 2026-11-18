import {describe,it,expect} from 'vitest';
import {TOOLS,getTool} from './tools';
describe('Tool catalog',()=>{
 it('exposes exactly twelve distinct tools',()=>{expect(TOOLS).toHaveLength(12);expect(new Set(TOOLS.map(t=>t.slug)).size).toBe(12)});
 it('returns unknown for unexpected slugs',()=>{expect(getTool('../admin')).toBeUndefined()});
});
