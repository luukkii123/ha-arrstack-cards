'use strict';
/* Serialises the testkit DOM like the browser's outerHTML (#1314).
 *
 * The cards build some markup from DOM nodes (BuschUI.header, BuschUI.stateBlock)
 * and put its outerHTML into their HTML sinks. The shared testkit keeps
 * innerHTML unparsed and has no outerHTML, so tests install this serialiser:
 * attributes, class, id, data-*, reflected type/title/disabled/hidden, escaped
 * text, the stored raw innerHTML and the children in order.
 */
const kit = require('./_testkit.cjs');

const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link']);
const text = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const quoted = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const dashed = (key) => key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

function serialize(node) {
  if (node.nodeType === 3) return text(node.data);
  if (node.nodeType !== 1) return (node.childNodes || []).map(serialize).join('');
  const attrs = { ...node.attributes };
  if (node.className) attrs.class = node.className; else delete attrs.class;
  if (node.id) attrs.id = node.id;
  for (const [key, value] of Object.entries(node.dataset || {})) attrs['data-' + dashed(key)] = value;
  if (node.type && !('type' in attrs)) attrs.type = node.type;
  if (node.title) attrs.title = node.title;
  if (node.disabled === true) attrs.disabled = '';
  if (node.hidden === true) attrs.hidden = '';
  const tag = node.localName;
  const open = `<${tag}${Object.entries(attrs).map(([key, value]) => ` ${key}="${quoted(value)}"`).join('')}>`;
  if (VOID.has(tag)) return open;
  return `${open}${node._innerHTML || ''}${node.childNodes.map(serialize).join('')}</${tag}>`;
}

/** Gives the Element class of a testkit environment or DOM a real outerHTML. */
function installOuterHTML(env) {
  Object.defineProperty(env.Element.prototype, 'outerHTML', { configurable: true, get() { return serialize(this); } });
  return env;
}

/** A testkit document whose elements serialise, for tests with their own small mocks. */
function markupDocument(language = 'de-DE') {
  return installOuterHTML(kit.createDom({ language })).document;
}

module.exports = { serialize, installOuterHTML, markupDocument };
