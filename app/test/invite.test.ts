import assert from 'node:assert/strict';
import { newIdentity, encodeCard } from '../src/core/crypto';
import { cardFromUrl, deepLink, inviteLink, inviteMessage } from '../src/core/invite';

const card = encodeCard(newIdentity(), 'Anna');
assert.equal(cardFromUrl(deepLink(card)), card);
assert.equal(cardFromUrl(inviteLink(card)), card);
assert.equal(cardFromUrl(`hello ${card} bye`), card);
assert.equal(cardFromUrl(inviteMessage(card, { inviteText: 'Hi', inviteGet: 'Get:', inviteHave: 'Have:', inviteCodeFallback: 'Code:' })), card, 'the whole SMS parses back to the card');
assert.equal(cardFromUrl('direct://add?c=direct1:garbage'), null);
assert.equal(cardFromUrl('https://example.com/?c=nothing'), null);
assert.equal(cardFromUrl(''), null);
assert.ok(!inviteLink(card).split('#')[0].includes('direct1:'), 'the card is only in the fragment');
console.log('invite: all tests OK');
