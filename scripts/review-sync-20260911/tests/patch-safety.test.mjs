import test from 'node:test';
import assert from 'node:assert/strict';
import { gitBlob, applyExact, validateInlineScripts } from '../scripts/apply-sync-hardening.mjs';
test('exact patch refuses a missing baseline', () => assert.throws(() => applyExact('unrelated', [{id:'a',old:'old',new:'new'}])));
test('exact patch refuses duplicate targets', () => assert.throws(() => applyExact('old old', [{id:'a',old:'old',new:'new'}])));
test('exact patch preserves unrelated bytes', () => assert.equal(applyExact('A\r\nold\r\nZ', [{id:'a',old:'old',new:'new'}]), 'A\r\nnew\r\nZ'));
test('inline parser rejects a syntax error without executing scripts', () => assert.throws(() => validateInlineScripts('<script>function (</script>')));
test('inline parser accepts scripts without executing them', () => assert.equal(validateInlineScripts('<script>throw new Error("must not execute");</script>'), 1));
test('Git blob hashing includes the blob header', () => assert.equal(gitBlob(Buffer.from('')), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'));
