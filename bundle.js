/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const directives = new WeakMap();
const isDirective = (o) => {
    return typeof o === 'function' && directives.has(o);
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * True if the custom elements polyfill is in use.
 */
const isCEPolyfill = typeof window !== 'undefined' &&
    window.customElements != null &&
    window.customElements.polyfillWrapFlushCallback !==
        undefined;
/**
 * Removes nodes, starting from `start` (inclusive) to `end` (exclusive), from
 * `container`.
 */
const removeNodes = (container, start, end = null) => {
    while (start !== end) {
        const n = start.nextSibling;
        container.removeChild(start);
        start = n;
    }
};

/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * A sentinel value that signals that a value was handled by a directive and
 * should not be written to the DOM.
 */
const noChange = {};
/**
 * A sentinel value that signals a NodePart to fully clear its content.
 */
const nothing = {};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An expression marker with embedded unique key to avoid collision with
 * possible text in templates.
 */
const marker = `{{lit-${String(Math.random()).slice(2)}}}`;
/**
 * An expression marker used text-positions, multi-binding attributes, and
 * attributes with markup-like text values.
 */
const nodeMarker = `<!--${marker}-->`;
const markerRegex = new RegExp(`${marker}|${nodeMarker}`);
/**
 * Suffix appended to all bound attribute names.
 */
const boundAttributeSuffix = '$lit$';
/**
 * An updatable Template that tracks the location of dynamic parts.
 */
class Template {
    constructor(result, element) {
        this.parts = [];
        this.element = element;
        const nodesToRemove = [];
        const stack = [];
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(element.content, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        // Keeps track of the last index associated with a part. We try to delete
        // unnecessary nodes, but we never want to associate two different parts
        // to the same index. They must have a constant node between.
        let lastPartIndex = 0;
        let index = -1;
        let partIndex = 0;
        const { strings, values: { length } } = result;
        while (partIndex < length) {
            const node = walker.nextNode();
            if (node === null) {
                // We've exhausted the content inside a nested template element.
                // Because we still have parts (the outer for-loop), we know:
                // - There is a template in the stack
                // - The walker will find a nextNode outside the template
                walker.currentNode = stack.pop();
                continue;
            }
            index++;
            if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
                if (node.hasAttributes()) {
                    const attributes = node.attributes;
                    const { length } = attributes;
                    // Per
                    // https://developer.mozilla.org/en-US/docs/Web/API/NamedNodeMap,
                    // attributes are not guaranteed to be returned in document order.
                    // In particular, Edge/IE can return them out of order, so we cannot
                    // assume a correspondence between part index and attribute index.
                    let count = 0;
                    for (let i = 0; i < length; i++) {
                        if (endsWith(attributes[i].name, boundAttributeSuffix)) {
                            count++;
                        }
                    }
                    while (count-- > 0) {
                        // Get the template literal section leading up to the first
                        // expression in this attribute
                        const stringForPart = strings[partIndex];
                        // Find the attribute name
                        const name = lastAttributeNameRegex.exec(stringForPart)[2];
                        // Find the corresponding attribute
                        // All bound attributes have had a suffix added in
                        // TemplateResult#getHTML to opt out of special attribute
                        // handling. To look up the attribute value we also need to add
                        // the suffix.
                        const attributeLookupName = name.toLowerCase() + boundAttributeSuffix;
                        const attributeValue = node.getAttribute(attributeLookupName);
                        node.removeAttribute(attributeLookupName);
                        const statics = attributeValue.split(markerRegex);
                        this.parts.push({ type: 'attribute', index, name, strings: statics });
                        partIndex += statics.length - 1;
                    }
                }
                if (node.tagName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
            }
            else if (node.nodeType === 3 /* Node.TEXT_NODE */) {
                const data = node.data;
                if (data.indexOf(marker) >= 0) {
                    const parent = node.parentNode;
                    const strings = data.split(markerRegex);
                    const lastIndex = strings.length - 1;
                    // Generate a new text node for each literal section
                    // These nodes are also used as the markers for node parts
                    for (let i = 0; i < lastIndex; i++) {
                        let insert;
                        let s = strings[i];
                        if (s === '') {
                            insert = createMarker();
                        }
                        else {
                            const match = lastAttributeNameRegex.exec(s);
                            if (match !== null && endsWith(match[2], boundAttributeSuffix)) {
                                s = s.slice(0, match.index) + match[1] +
                                    match[2].slice(0, -boundAttributeSuffix.length) + match[3];
                            }
                            insert = document.createTextNode(s);
                        }
                        parent.insertBefore(insert, node);
                        this.parts.push({ type: 'node', index: ++index });
                    }
                    // If there's no text, we must insert a comment to mark our place.
                    // Else, we can trust it will stick around after cloning.
                    if (strings[lastIndex] === '') {
                        parent.insertBefore(createMarker(), node);
                        nodesToRemove.push(node);
                    }
                    else {
                        node.data = strings[lastIndex];
                    }
                    // We have a part for each match found
                    partIndex += lastIndex;
                }
            }
            else if (node.nodeType === 8 /* Node.COMMENT_NODE */) {
                if (node.data === marker) {
                    const parent = node.parentNode;
                    // Add a new marker node to be the startNode of the Part if any of
                    // the following are true:
                    //  * We don't have a previousSibling
                    //  * The previousSibling is already the start of a previous part
                    if (node.previousSibling === null || index === lastPartIndex) {
                        index++;
                        parent.insertBefore(createMarker(), node);
                    }
                    lastPartIndex = index;
                    this.parts.push({ type: 'node', index });
                    // If we don't have a nextSibling, keep this node so we have an end.
                    // Else, we can remove it to save future costs.
                    if (node.nextSibling === null) {
                        node.data = '';
                    }
                    else {
                        nodesToRemove.push(node);
                        index--;
                    }
                    partIndex++;
                }
                else {
                    let i = -1;
                    while ((i = node.data.indexOf(marker, i + 1)) !== -1) {
                        // Comment node has a binding marker inside, make an inactive part
                        // The binding won't work, but subsequent bindings will
                        // TODO (justinfagnani): consider whether it's even worth it to
                        // make bindings in comments work
                        this.parts.push({ type: 'node', index: -1 });
                        partIndex++;
                    }
                }
            }
        }
        // Remove text binding nodes after the walk to not disturb the TreeWalker
        for (const n of nodesToRemove) {
            n.parentNode.removeChild(n);
        }
    }
}
const endsWith = (str, suffix) => {
    const index = str.length - suffix.length;
    return index >= 0 && str.slice(index) === suffix;
};
const isTemplatePartActive = (part) => part.index !== -1;
// Allows `document.createComment('')` to be renamed for a
// small manual size-savings.
const createMarker = () => document.createComment('');
/**
 * This regex extracts the attribute name preceding an attribute-position
 * expression. It does this by matching the syntax allowed for attributes
 * against the string literal directly preceding the expression, assuming that
 * the expression is in an attribute-value position.
 *
 * See attributes in the HTML spec:
 * https://www.w3.org/TR/html5/syntax.html#elements-attributes
 *
 * " \x09\x0a\x0c\x0d" are HTML space characters:
 * https://www.w3.org/TR/html5/infrastructure.html#space-characters
 *
 * "\0-\x1F\x7F-\x9F" are Unicode control characters, which includes every
 * space character except " ".
 *
 * So an attribute is:
 *  * The name: any character except a control character, space character, ('),
 *    ("), ">", "=", or "/"
 *  * Followed by zero or more space characters
 *  * Followed by "="
 *  * Followed by zero or more space characters
 *  * Followed by:
 *    * Any character except space, ('), ("), "<", ">", "=", (`), or
 *    * (") then any non-("), or
 *    * (') then any non-(')
 */
const lastAttributeNameRegex = 
// eslint-disable-next-line no-control-regex
/([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An instance of a `Template` that can be attached to the DOM and updated
 * with new values.
 */
class TemplateInstance {
    constructor(template, processor, options) {
        this.__parts = [];
        this.template = template;
        this.processor = processor;
        this.options = options;
    }
    update(values) {
        let i = 0;
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.setValue(values[i]);
            }
            i++;
        }
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.commit();
            }
        }
    }
    _clone() {
        // There are a number of steps in the lifecycle of a template instance's
        // DOM fragment:
        //  1. Clone - create the instance fragment
        //  2. Adopt - adopt into the main document
        //  3. Process - find part markers and create parts
        //  4. Upgrade - upgrade custom elements
        //  5. Update - set node, attribute, property, etc., values
        //  6. Connect - connect to the document. Optional and outside of this
        //     method.
        //
        // We have a few constraints on the ordering of these steps:
        //  * We need to upgrade before updating, so that property values will pass
        //    through any property setters.
        //  * We would like to process before upgrading so that we're sure that the
        //    cloned fragment is inert and not disturbed by self-modifying DOM.
        //  * We want custom elements to upgrade even in disconnected fragments.
        //
        // Given these constraints, with full custom elements support we would
        // prefer the order: Clone, Process, Adopt, Upgrade, Update, Connect
        //
        // But Safari does not implement CustomElementRegistry#upgrade, so we
        // can not implement that order and still have upgrade-before-update and
        // upgrade disconnected fragments. So we instead sacrifice the
        // process-before-upgrade constraint, since in Custom Elements v1 elements
        // must not modify their light DOM in the constructor. We still have issues
        // when co-existing with CEv0 elements like Polymer 1, and with polyfills
        // that don't strictly adhere to the no-modification rule because shadow
        // DOM, which may be created in the constructor, is emulated by being placed
        // in the light DOM.
        //
        // The resulting order is on native is: Clone, Adopt, Upgrade, Process,
        // Update, Connect. document.importNode() performs Clone, Adopt, and Upgrade
        // in one step.
        //
        // The Custom Elements v1 polyfill supports upgrade(), so the order when
        // polyfilled is the more ideal: Clone, Process, Adopt, Upgrade, Update,
        // Connect.
        const fragment = isCEPolyfill ?
            this.template.element.content.cloneNode(true) :
            document.importNode(this.template.element.content, true);
        const stack = [];
        const parts = this.template.parts;
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(fragment, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        let partIndex = 0;
        let nodeIndex = 0;
        let part;
        let node = walker.nextNode();
        // Loop through all the nodes and parts of a template
        while (partIndex < parts.length) {
            part = parts[partIndex];
            if (!isTemplatePartActive(part)) {
                this.__parts.push(undefined);
                partIndex++;
                continue;
            }
            // Progress the tree walker until we find our next part's node.
            // Note that multiple parts may share the same node (attribute parts
            // on a single element), so this loop may not run at all.
            while (nodeIndex < part.index) {
                nodeIndex++;
                if (node.nodeName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
                if ((node = walker.nextNode()) === null) {
                    // We've exhausted the content inside a nested template element.
                    // Because we still have parts (the outer for-loop), we know:
                    // - There is a template in the stack
                    // - The walker will find a nextNode outside the template
                    walker.currentNode = stack.pop();
                    node = walker.nextNode();
                }
            }
            // We've arrived at our part's node.
            if (part.type === 'node') {
                const part = this.processor.handleTextExpression(this.options);
                part.insertAfterNode(node.previousSibling);
                this.__parts.push(part);
            }
            else {
                this.__parts.push(...this.processor.handleAttributeExpressions(node, part.name, part.strings, this.options));
            }
            partIndex++;
        }
        if (isCEPolyfill) {
            document.adoptNode(fragment);
            customElements.upgrade(fragment);
        }
        return fragment;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const commentMarker = ` ${marker} `;
/**
 * The return type of `html`, which holds a Template and the values from
 * interpolated expressions.
 */
class TemplateResult {
    constructor(strings, values, type, processor) {
        this.strings = strings;
        this.values = values;
        this.type = type;
        this.processor = processor;
    }
    /**
     * Returns a string of HTML used to create a `<template>` element.
     */
    getHTML() {
        const l = this.strings.length - 1;
        let html = '';
        let isCommentBinding = false;
        for (let i = 0; i < l; i++) {
            const s = this.strings[i];
            // For each binding we want to determine the kind of marker to insert
            // into the template source before it's parsed by the browser's HTML
            // parser. The marker type is based on whether the expression is in an
            // attribute, text, or comment position.
            //   * For node-position bindings we insert a comment with the marker
            //     sentinel as its text content, like <!--{{lit-guid}}-->.
            //   * For attribute bindings we insert just the marker sentinel for the
            //     first binding, so that we support unquoted attribute bindings.
            //     Subsequent bindings can use a comment marker because multi-binding
            //     attributes must be quoted.
            //   * For comment bindings we insert just the marker sentinel so we don't
            //     close the comment.
            //
            // The following code scans the template source, but is *not* an HTML
            // parser. We don't need to track the tree structure of the HTML, only
            // whether a binding is inside a comment, and if not, if it appears to be
            // the first binding in an attribute.
            const commentOpen = s.lastIndexOf('<!--');
            // We're in comment position if we have a comment open with no following
            // comment close. Because <-- can appear in an attribute value there can
            // be false positives.
            isCommentBinding = (commentOpen > -1 || isCommentBinding) &&
                s.indexOf('-->', commentOpen + 1) === -1;
            // Check to see if we have an attribute-like sequence preceding the
            // expression. This can match "name=value" like structures in text,
            // comments, and attribute values, so there can be false-positives.
            const attributeMatch = lastAttributeNameRegex.exec(s);
            if (attributeMatch === null) {
                // We're only in this branch if we don't have a attribute-like
                // preceding sequence. For comments, this guards against unusual
                // attribute values like <div foo="<!--${'bar'}">. Cases like
                // <!-- foo=${'bar'}--> are handled correctly in the attribute branch
                // below.
                html += s + (isCommentBinding ? commentMarker : nodeMarker);
            }
            else {
                // For attributes we use just a marker sentinel, and also append a
                // $lit$ suffix to the name to opt-out of attribute-specific parsing
                // that IE and Edge do for style and certain SVG attributes.
                html += s.substr(0, attributeMatch.index) + attributeMatch[1] +
                    attributeMatch[2] + boundAttributeSuffix + attributeMatch[3] +
                    marker;
            }
        }
        html += this.strings[l];
        return html;
    }
    getTemplateElement() {
        const template = document.createElement('template');
        template.innerHTML = this.getHTML();
        return template;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const isPrimitive = (value) => {
    return (value === null ||
        !(typeof value === 'object' || typeof value === 'function'));
};
const isIterable = (value) => {
    return Array.isArray(value) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        !!(value && value[Symbol.iterator]);
};
/**
 * Writes attribute values to the DOM for a group of AttributeParts bound to a
 * single attribute. The value is only set once even if there are multiple parts
 * for an attribute.
 */
class AttributeCommitter {
    constructor(element, name, strings) {
        this.dirty = true;
        this.element = element;
        this.name = name;
        this.strings = strings;
        this.parts = [];
        for (let i = 0; i < strings.length - 1; i++) {
            this.parts[i] = this._createPart();
        }
    }
    /**
     * Creates a single part. Override this to create a differnt type of part.
     */
    _createPart() {
        return new AttributePart(this);
    }
    _getValue() {
        const strings = this.strings;
        const l = strings.length - 1;
        let text = '';
        for (let i = 0; i < l; i++) {
            text += strings[i];
            const part = this.parts[i];
            if (part !== undefined) {
                const v = part.value;
                if (isPrimitive(v) || !isIterable(v)) {
                    text += typeof v === 'string' ? v : String(v);
                }
                else {
                    for (const t of v) {
                        text += typeof t === 'string' ? t : String(t);
                    }
                }
            }
        }
        text += strings[l];
        return text;
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            this.element.setAttribute(this.name, this._getValue());
        }
    }
}
/**
 * A Part that controls all or part of an attribute value.
 */
class AttributePart {
    constructor(committer) {
        this.value = undefined;
        this.committer = committer;
    }
    setValue(value) {
        if (value !== noChange && (!isPrimitive(value) || value !== this.value)) {
            this.value = value;
            // If the value is a not a directive, dirty the committer so that it'll
            // call setAttribute. If the value is a directive, it'll dirty the
            // committer if it calls setValue().
            if (!isDirective(value)) {
                this.committer.dirty = true;
            }
        }
    }
    commit() {
        while (isDirective(this.value)) {
            const directive = this.value;
            this.value = noChange;
            directive(this);
        }
        if (this.value === noChange) {
            return;
        }
        this.committer.commit();
    }
}
/**
 * A Part that controls a location within a Node tree. Like a Range, NodePart
 * has start and end locations and can set and update the Nodes between those
 * locations.
 *
 * NodeParts support several value types: primitives, Nodes, TemplateResults,
 * as well as arrays and iterables of those types.
 */
class NodePart {
    constructor(options) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.options = options;
    }
    /**
     * Appends this part into a container.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendInto(container) {
        this.startNode = container.appendChild(createMarker());
        this.endNode = container.appendChild(createMarker());
    }
    /**
     * Inserts this part after the `ref` node (between `ref` and `ref`'s next
     * sibling). Both `ref` and its next sibling must be static, unchanging nodes
     * such as those that appear in a literal section of a template.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterNode(ref) {
        this.startNode = ref;
        this.endNode = ref.nextSibling;
    }
    /**
     * Appends this part into a parent part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendIntoPart(part) {
        part.__insert(this.startNode = createMarker());
        part.__insert(this.endNode = createMarker());
    }
    /**
     * Inserts this part after the `ref` part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterPart(ref) {
        ref.__insert(this.startNode = createMarker());
        this.endNode = ref.endNode;
        ref.endNode = this.startNode;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        if (this.startNode.parentNode === null) {
            return;
        }
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        const value = this.__pendingValue;
        if (value === noChange) {
            return;
        }
        if (isPrimitive(value)) {
            if (value !== this.value) {
                this.__commitText(value);
            }
        }
        else if (value instanceof TemplateResult) {
            this.__commitTemplateResult(value);
        }
        else if (value instanceof Node) {
            this.__commitNode(value);
        }
        else if (isIterable(value)) {
            this.__commitIterable(value);
        }
        else if (value === nothing) {
            this.value = nothing;
            this.clear();
        }
        else {
            // Fallback, will render the string representation
            this.__commitText(value);
        }
    }
    __insert(node) {
        this.endNode.parentNode.insertBefore(node, this.endNode);
    }
    __commitNode(value) {
        if (this.value === value) {
            return;
        }
        this.clear();
        this.__insert(value);
        this.value = value;
    }
    __commitText(value) {
        const node = this.startNode.nextSibling;
        value = value == null ? '' : value;
        // If `value` isn't already a string, we explicitly convert it here in case
        // it can't be implicitly converted - i.e. it's a symbol.
        const valueAsString = typeof value === 'string' ? value : String(value);
        if (node === this.endNode.previousSibling &&
            node.nodeType === 3 /* Node.TEXT_NODE */) {
            // If we only have a single text node between the markers, we can just
            // set its value, rather than replacing it.
            // TODO(justinfagnani): Can we just check if this.value is primitive?
            node.data = valueAsString;
        }
        else {
            this.__commitNode(document.createTextNode(valueAsString));
        }
        this.value = value;
    }
    __commitTemplateResult(value) {
        const template = this.options.templateFactory(value);
        if (this.value instanceof TemplateInstance &&
            this.value.template === template) {
            this.value.update(value.values);
        }
        else {
            // Make sure we propagate the template processor from the TemplateResult
            // so that we use its syntax extension, etc. The template factory comes
            // from the render function options so that it can control template
            // caching and preprocessing.
            const instance = new TemplateInstance(template, value.processor, this.options);
            const fragment = instance._clone();
            instance.update(value.values);
            this.__commitNode(fragment);
            this.value = instance;
        }
    }
    __commitIterable(value) {
        // For an Iterable, we create a new InstancePart per item, then set its
        // value to the item. This is a little bit of overhead for every item in
        // an Iterable, but it lets us recurse easily and efficiently update Arrays
        // of TemplateResults that will be commonly returned from expressions like:
        // array.map((i) => html`${i}`), by reusing existing TemplateInstances.
        // If _value is an array, then the previous render was of an
        // iterable and _value will contain the NodeParts from the previous
        // render. If _value is not an array, clear this part and make a new
        // array for NodeParts.
        if (!Array.isArray(this.value)) {
            this.value = [];
            this.clear();
        }
        // Lets us keep track of how many items we stamped so we can clear leftover
        // items from a previous render
        const itemParts = this.value;
        let partIndex = 0;
        let itemPart;
        for (const item of value) {
            // Try to reuse an existing part
            itemPart = itemParts[partIndex];
            // If no existing part, create a new one
            if (itemPart === undefined) {
                itemPart = new NodePart(this.options);
                itemParts.push(itemPart);
                if (partIndex === 0) {
                    itemPart.appendIntoPart(this);
                }
                else {
                    itemPart.insertAfterPart(itemParts[partIndex - 1]);
                }
            }
            itemPart.setValue(item);
            itemPart.commit();
            partIndex++;
        }
        if (partIndex < itemParts.length) {
            // Truncate the parts array so _value reflects the current state
            itemParts.length = partIndex;
            this.clear(itemPart && itemPart.endNode);
        }
    }
    clear(startNode = this.startNode) {
        removeNodes(this.startNode.parentNode, startNode.nextSibling, this.endNode);
    }
}
/**
 * Implements a boolean attribute, roughly as defined in the HTML
 * specification.
 *
 * If the value is truthy, then the attribute is present with a value of
 * ''. If the value is falsey, the attribute is removed.
 */
class BooleanAttributePart {
    constructor(element, name, strings) {
        this.value = undefined;
        this.__pendingValue = undefined;
        if (strings.length !== 2 || strings[0] !== '' || strings[1] !== '') {
            throw new Error('Boolean attributes can only contain a single expression');
        }
        this.element = element;
        this.name = name;
        this.strings = strings;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const value = !!this.__pendingValue;
        if (this.value !== value) {
            if (value) {
                this.element.setAttribute(this.name, '');
            }
            else {
                this.element.removeAttribute(this.name);
            }
            this.value = value;
        }
        this.__pendingValue = noChange;
    }
}
/**
 * Sets attribute values for PropertyParts, so that the value is only set once
 * even if there are multiple parts for a property.
 *
 * If an expression controls the whole property value, then the value is simply
 * assigned to the property under control. If there are string literals or
 * multiple expressions, then the strings are expressions are interpolated into
 * a string first.
 */
class PropertyCommitter extends AttributeCommitter {
    constructor(element, name, strings) {
        super(element, name, strings);
        this.single =
            (strings.length === 2 && strings[0] === '' && strings[1] === '');
    }
    _createPart() {
        return new PropertyPart(this);
    }
    _getValue() {
        if (this.single) {
            return this.parts[0].value;
        }
        return super._getValue();
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.element[this.name] = this._getValue();
        }
    }
}
class PropertyPart extends AttributePart {
}
// Detect event listener options support. If the `capture` property is read
// from the options object, then options are supported. If not, then the third
// argument to add/removeEventListener is interpreted as the boolean capture
// value so we should only pass the `capture` property.
let eventOptionsSupported = false;
// Wrap into an IIFE because MS Edge <= v41 does not support having try/catch
// blocks right into the body of a module
(() => {
    try {
        const options = {
            get capture() {
                eventOptionsSupported = true;
                return false;
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.addEventListener('test', options, options);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.removeEventListener('test', options, options);
    }
    catch (_e) {
        // event options not supported
    }
})();
class EventPart {
    constructor(element, eventName, eventContext) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.element = element;
        this.eventName = eventName;
        this.eventContext = eventContext;
        this.__boundHandleEvent = (e) => this.handleEvent(e);
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const newListener = this.__pendingValue;
        const oldListener = this.value;
        const shouldRemoveListener = newListener == null ||
            oldListener != null &&
                (newListener.capture !== oldListener.capture ||
                    newListener.once !== oldListener.once ||
                    newListener.passive !== oldListener.passive);
        const shouldAddListener = newListener != null && (oldListener == null || shouldRemoveListener);
        if (shouldRemoveListener) {
            this.element.removeEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        if (shouldAddListener) {
            this.__options = getOptions(newListener);
            this.element.addEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        this.value = newListener;
        this.__pendingValue = noChange;
    }
    handleEvent(event) {
        if (typeof this.value === 'function') {
            this.value.call(this.eventContext || this.element, event);
        }
        else {
            this.value.handleEvent(event);
        }
    }
}
// We copy options because of the inconsistent behavior of browsers when reading
// the third argument of add/removeEventListener. IE11 doesn't support options
// at all. Chrome 41 only reads `capture` if the argument is an object.
const getOptions = (o) => o &&
    (eventOptionsSupported ?
        { capture: o.capture, passive: o.passive, once: o.once } :
        o.capture);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Creates Parts when a template is instantiated.
 */
class DefaultTemplateProcessor {
    /**
     * Create parts for an attribute-position binding, given the event, attribute
     * name, and string literals.
     *
     * @param element The element containing the binding
     * @param name  The attribute name
     * @param strings The string literals. There are always at least two strings,
     *   event for fully-controlled bindings with a single expression.
     */
    handleAttributeExpressions(element, name, strings, options) {
        const prefix = name[0];
        if (prefix === '.') {
            const committer = new PropertyCommitter(element, name.slice(1), strings);
            return committer.parts;
        }
        if (prefix === '@') {
            return [new EventPart(element, name.slice(1), options.eventContext)];
        }
        if (prefix === '?') {
            return [new BooleanAttributePart(element, name.slice(1), strings)];
        }
        const committer = new AttributeCommitter(element, name, strings);
        return committer.parts;
    }
    /**
     * Create parts for a text-position binding.
     * @param templateFactory
     */
    handleTextExpression(options) {
        return new NodePart(options);
    }
}
const defaultTemplateProcessor = new DefaultTemplateProcessor();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * The default TemplateFactory which caches Templates keyed on
 * result.type and result.strings.
 */
function templateFactory(result) {
    let templateCache = templateCaches.get(result.type);
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(result.type, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== undefined) {
        return template;
    }
    // If the TemplateStringsArray is new, generate a key from the strings
    // This key is shared between all templates with identical content
    const key = result.strings.join(marker);
    // Check if we already have a Template for this key
    template = templateCache.keyString.get(key);
    if (template === undefined) {
        // If we have not seen this key before, create a new Template
        template = new Template(result, result.getTemplateElement());
        // Cache the Template for this key
        templateCache.keyString.set(key, template);
    }
    // Cache all future queries for this TemplateStringsArray
    templateCache.stringsArray.set(result.strings, template);
    return template;
}
const templateCaches = new Map();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const parts = new WeakMap();
/**
 * Renders a template result or other value to a container.
 *
 * To update a container with new values, reevaluate the template literal and
 * call `render` with the new result.
 *
 * @param result Any value renderable by NodePart - typically a TemplateResult
 *     created by evaluating a template tag like `html` or `svg`.
 * @param container A DOM parent to render to. The entire contents are either
 *     replaced, or efficiently updated if the same result type was previous
 *     rendered there.
 * @param options RenderOptions for the entire render tree rendered to this
 *     container. Render options must *not* change between renders to the same
 *     container, as those changes will not effect previously rendered DOM.
 */
const render = (result, container, options) => {
    let part = parts.get(container);
    if (part === undefined) {
        removeNodes(container, container.firstChild);
        parts.set(container, part = new NodePart(Object.assign({ templateFactory }, options)));
        part.appendInto(container);
    }
    part.setValue(result);
    part.commit();
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for lit-html usage.
// TODO(justinfagnani): inject version number at build time
if (typeof window !== 'undefined') {
    (window['litHtmlVersions'] || (window['litHtmlVersions'] = [])).push('1.2.1');
}
/**
 * Interprets a template literal as an HTML template that can efficiently
 * render to and update a container.
 */
const html = (strings, ...values) => new TemplateResult(strings, values, 'html', defaultTemplateProcessor);

class EnoError extends Error {
  constructor(text, snippet, selection) {
    super(`${text}\n\n${snippet}`);

    this.selection = selection;
    this.snippet = snippet;
    this.text = text;

    if(Error.captureStackTrace) {
      Error.captureStackTrace(this, EnoError);
    }
  }

  get cursor() {
    return this.selection.from;
  }
}

class ParseError extends EnoError {
  constructor(...args) {
    super(...args);

    if(Error.captureStackTrace) {
      Error.captureStackTrace(this, ParseError);
    }
  }
}

class ValidationError extends EnoError {
  constructor(...args) {
    super(...args);

    if(Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

var EnoError_1 = EnoError;
var ParseError_1 = ParseError;
var ValidationError_1 = ValidationError;

var error_types = {
	EnoError: EnoError_1,
	ParseError: ParseError_1,
	ValidationError: ValidationError_1
};

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

function commonjsRequire () {
	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
}

var constants = createCommonjsModule(function (module, exports) {
// Added to 0-indexed indices in a few places
exports.HUMAN_INDEXING = 1;

// Selection indices
exports.BEGIN = 0;
exports.END = 1;

// Instruction types
exports.COMMENT = Symbol('Comment');
exports.CONTINUATION = Symbol('Continuation');
exports.DOCUMENT = Symbol('Document');
exports.EMPTY = Symbol('Empty');
exports.FIELD = Symbol('Field');
exports.FIELDSET = Symbol('Fieldset');
exports.FIELDSET_ENTRY = Symbol('Fieldset Entry');
exports.FIELD_OR_FIELDSET_OR_LIST = Symbol('Field, Fieldset or List');
exports.LIST = Symbol('List');
exports.LIST_ITEM = Symbol('List Item');
exports.MULTILINE_FIELD_BEGIN = Symbol('Multiline Field Begin');
exports.MULTILINE_FIELD_END = Symbol('Multiline Field End');
exports.MULTILINE_FIELD_VALUE = Symbol('Multiline Field Value');
exports.SECTION = Symbol('Section');
exports.UNPARSED = Symbol('Unparsed');

// Maps instruction type symbols to printable strings
exports.PRETTY_TYPES = {
  [exports.DOCUMENT]: 'document',
  [exports.EMPTY]: 'empty',
  [exports.FIELD]: 'field',
  [exports.FIELDSET]: 'fieldset',
  [exports.FIELDSET_ENTRY]: 'fieldsetEntry',
  [exports.FIELD_OR_FIELDSET_OR_LIST]: 'fieldOrFieldsetOrList',
  [exports.LIST]: 'list',
  [exports.LIST_ITEM]: 'listItem',
  [exports.MULTILINE_FIELD_BEGIN]: 'field',
  [exports.SECTION]: 'section'
};
});
var constants_1 = constants.HUMAN_INDEXING;
var constants_2 = constants.BEGIN;
var constants_3 = constants.END;
var constants_4 = constants.COMMENT;
var constants_5 = constants.CONTINUATION;
var constants_6 = constants.DOCUMENT;
var constants_7 = constants.EMPTY;
var constants_8 = constants.FIELD;
var constants_9 = constants.FIELDSET;
var constants_10 = constants.FIELDSET_ENTRY;
var constants_11 = constants.FIELD_OR_FIELDSET_OR_LIST;
var constants_12 = constants.LIST;
var constants_13 = constants.LIST_ITEM;
var constants_14 = constants.MULTILINE_FIELD_BEGIN;
var constants_15 = constants.MULTILINE_FIELD_END;
var constants_16 = constants.MULTILINE_FIELD_VALUE;
var constants_17 = constants.SECTION;
var constants_18 = constants.UNPARSED;
var constants_19 = constants.PRETTY_TYPES;

const {
  DOCUMENT,
  FIELD,
  FIELDSET,
  FIELDSET_ENTRY,
  LIST,
  LIST_ITEM,
  MULTILINE_FIELD_BEGIN,
  SECTION: SECTION$1
} = constants;

// TODO: Better simple lastIn() / lastMissingIn() utility function usage to get m...n range for tagging?

const DISPLAY = Symbol('Display Line');
const EMPHASIZE = Symbol('Emphasize Line');
const INDICATE = Symbol('Indicate Line');
const OMISSION = Symbol('Insert Omission');
const QUESTION = Symbol('Question Line');

class Reporter {
  constructor(context) {
    this._context = context;
    this._index = new Array(this._context._lineCount);
    this._snippet = new Array(this._context._lineCount);

    this._buildIndex();
  }

  _buildIndex() {
    const indexComments = element => {
      if(element.hasOwnProperty('comments')) {
        for(const comment of element.comments) {
          this._index[comment.line] = comment;
        }
      }
    };

    const traverse = section => {
      for(const element of section.elements) {
        indexComments(element);

        this._index[element.line] = element;

        if(element.type === SECTION$1) {
          traverse(element);
        } else if(element.type === FIELD) {
          if(element.hasOwnProperty('continuations')) {
            for(const continuation of element.continuations) {
              this._index[continuation.line] = continuation;
            }
          }
        } else if(element.type === MULTILINE_FIELD_BEGIN) {
          // Missing when reporting an unterminated multiline field
          if(element.hasOwnProperty('end')) {
            this._index[element.end.line] = element.end;
          }

          for(const line of element.lines) {
            this._index[line.line] = line;
          }
        } else if(element.type === LIST) {
          if(element.hasOwnProperty('items')) {
            for(const item of element.items) {
              indexComments(item);

              this._index[item.line] = item;

              for(const continuation of item.continuations) {
                this._index[continuation.line] = continuation;
              }
            }
          }
        } else if(element.type === FIELDSET) {
          if(element.hasOwnProperty('entries')) {
            for(const entry of element.entries) {
              indexComments(entry);

              this._index[entry.line] = entry;

              for(const continuation of entry.continuations) {
                this._index[continuation.line] = continuation;
              }
            }
          }
        }
      }
    };

    traverse(this._context._document);

    for(const meta of this._context._meta) {
      this._index[meta.line] = meta;
    }
  }

  _tagContinuations(element, tag) {
    let scanLine = element.line + 1;

    if(element.continuations.length === 0)
      return scanLine;

    for(const continuation of element.continuations) {
      while(scanLine < continuation.line) {
        this._snippet[scanLine] = tag;
        scanLine++;
      }

      this._snippet[continuation.line] = tag;
      scanLine++;
    }

    return scanLine;
  }

  _tagContinuables(element, collection, tag) {
    let scanLine = element.line + 1;

    if(element[collection].length === 0)
      return scanLine;

    for(const continuable of element[collection]) {
      while(scanLine < continuable.line) {
        this._snippet[scanLine] = tag;
        scanLine++;
      }

      this._snippet[continuable.line] = tag;

      scanLine = this._tagContinuations(continuable, tag);
    }

    return scanLine;
  }

  _tagChildren(element, tag) {
    if(element.type === FIELD || element.type === LIST_ITEM || element.type === FIELDSET_ENTRY) {
      return this._tagContinuations(element, tag);
    } else if(element.type === LIST) {
      return this._tagContinuables(element, 'items', tag);
    } else if(element.type === FIELDSET) {
      return this._tagContinuables(element, 'entries', tag);
    } else if(element.type === MULTILINE_FIELD_BEGIN) {
      for(const line of element.lines) {
        this._snippet[line.line] = tag;
      }

      if(element.hasOwnProperty('end')) {
        this._snippet[element.end.line] = tag;
        return element.end.line + 1;
      } else if(element.lines.length > 0) {
        return element.lines[element.lines.length - 1].line + 1;
      } else {
        return element.line + 1;
      }
    } else if(element.type === SECTION$1) {
      return this._tagSection(element, tag);
    }
  }

  _tagSection(section, tag, recursive = true) {
    let scanLine = section.line + 1;

    for(const element of section.elements) {
      while(scanLine < element.line) {
        this._snippet[scanLine] = tag;
        scanLine++;
      }

      if(!recursive && element.type === SECTION$1) break;

      this._snippet[element.line] = tag;

      scanLine = this._tagChildren(element, tag);
    }

    return scanLine;
  }

  indicateLine(element) {
    this._snippet[element.line] = INDICATE;
    return this;
  }

  questionLine(element) {
    this._snippet[element.line] = QUESTION;
    return this;
  }

  reportComments(element) {
    this._snippet[element.line] = INDICATE;
    for(const comment of element.comments) {
      this._snippet[comment.line] = EMPHASIZE;
    }

    return this;
  }

  reportElement(element) {
    this._snippet[element.line] = EMPHASIZE;
    this._tagChildren(element, INDICATE);

    return this;
  }

  reportElements(elements) {
    for(const element of elements) {
      this._snippet[element.line] = EMPHASIZE;
      this._tagChildren(element, INDICATE);
    }

    return this;
  }

  reportLine(instruction) {
    this._snippet[instruction.line] = EMPHASIZE;

    return this;
  }

  reportMultilineValue(element) {
    for(const line of element.lines) {
      this._snippet[line.line] = EMPHASIZE;
    }

    return this;
  }

  reportMissingElement(parent) {
    if(parent.type !== DOCUMENT) {
      this._snippet[parent.line] = INDICATE;
    }

    if(parent.type === SECTION$1) {
      this._tagSection(parent, QUESTION, false);
    } else {
      this._tagChildren(parent, QUESTION);
    }

    return this;
  }

  snippet() {
    if(this._snippet.every(line => line === undefined)) {
      for(let line = 0; line < this._snippet.length; line++) {
        this._snippet[line] = QUESTION;
      }
    } else {
      // TODO: Possibly better algorithm for this

      for(const [line, tag] of this._snippet.entries()) {
        if(tag !== undefined) continue;

        // TODO: Prevent out of bounds access
        if(this._snippet[line + 2] !== undefined && this._snippet[line + 2] !== DISPLAY ||
           this._snippet[line - 2] !== undefined && this._snippet[line - 2] !== DISPLAY ||
           this._snippet[line + 1] !== undefined && this._snippet[line + 1] !== DISPLAY ||
           this._snippet[line - 1] !== undefined && this._snippet[line - 1] !== DISPLAY) {
          this._snippet[line] = DISPLAY;
        } else if(this._snippet[line + 3] !== undefined && this._snippet[line + 3] !== DISPLAY) {
          this._snippet[line] = OMISSION;
        }
      }

      if(this._snippet[this._snippet.length - 1] === undefined) {
        this._snippet[this._snippet.length - 1] = OMISSION;
      }
    }

    return this._print();
  }
}

var DISPLAY_1 = DISPLAY;
var EMPHASIZE_1 = EMPHASIZE;
var INDICATE_1 = INDICATE;
var OMISSION_1 = OMISSION;
var QUESTION_1 = QUESTION;

var Reporter_1 = Reporter;

var reporter = {
	DISPLAY: DISPLAY_1,
	EMPHASIZE: EMPHASIZE_1,
	INDICATE: INDICATE_1,
	OMISSION: OMISSION_1,
	QUESTION: QUESTION_1,
	Reporter: Reporter_1
};

const { EMPHASIZE: EMPHASIZE$1, INDICATE: INDICATE$1, OMISSION: OMISSION$1, QUESTION: QUESTION$1 } = reporter;
const { HUMAN_INDEXING } = constants;
const { Reporter: Reporter$1 } = reporter;

// TODO: Possibly introduce here too
// const INDICATORS = {
//   [DISPLAY]: ' ',
//   [EMPHASIZE]: '>',
//   [INDICATE]: '*',
//   [QUESTION]: '?'
// };

const HTML_ESCAPE = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;'
};

const escape = string => string.replace(/[&<>"'/]/g, c => HTML_ESCAPE[c]);

class HtmlReporter extends Reporter$1 {
  _line(line, tag) {
    if(tag === OMISSION$1)
      return this._markup('...', '...');

    const number = (line + HUMAN_INDEXING).toString();
    const instruction = this._index[line];


    let content;
    if(instruction === undefined) {
      content = '';
    }  else {
      content = this._context._input.substring(instruction.ranges.line[0], instruction.ranges.line[1]);
    }

    let tagClass;
    if(tag === EMPHASIZE$1) {
      tagClass = 'eno-report-line-emphasized';
    } else if(tag === INDICATE$1) {
      tagClass = 'eno-report-line-indicated';
    } else if(tag === QUESTION$1) {
      tagClass = 'eno-report-line-questioned';
    }

    return this._markup(number, content, tagClass);
  }

  _markup(gutter, content, tagClass = '') {
    return `<div class="eno-report-line ${tagClass}">` +
           `<div class="eno-report-gutter">${gutter.padStart(10)}</div>` +
           `<div class="eno-report-content">${escape(content)}</div>` +
           '</div>';
  }

  _print() {
    const columnsHeader = this._markup(this._context.messages.gutterHeader, this._context.messages.contentHeader);
    const snippet = this._snippet.map((tag, line) => this._line(line, tag))
                                 .filter(line => line !== undefined)
                                 .join('');

    return `<div>${this._context.source ? `<div>${this._context.source}</div>` : ''}<pre class="eno-report">${columnsHeader}${snippet}</pre></div>`;
  }
}

var HtmlReporter_1 = HtmlReporter;

var html_reporter = {
	HtmlReporter: HtmlReporter_1
};

const {
  BEGIN,
  END,
  FIELD: FIELD$1,
  FIELDSET: FIELDSET$1,
  FIELDSET_ENTRY: FIELDSET_ENTRY$1,
  LIST: LIST$1,
  LIST_ITEM: LIST_ITEM$1,
  MULTILINE_FIELD_BEGIN: MULTILINE_FIELD_BEGIN$1,
  SECTION: SECTION$2
} = constants;

// TODO: Strongly consider reverse iteration and/or last subinstruction checks to speed up some lastIn/etc. algorithms here

const lastIn = element => {
  if((element.type === FIELD$1 || element.type === LIST_ITEM$1 || element.type === FIELDSET_ENTRY$1) && element.continuations.length > 0) {
    return element.continuations[element.continuations.length - 1];
  } else if(element.type === LIST$1 && element.items.length > 0) {
    return lastIn(element.items[element.items.length - 1]);
  } else if(element.type === FIELDSET$1 && element.entries.length > 0) {
    return lastIn(element.entries[element.entries.length - 1]);
  } else if(element.type === MULTILINE_FIELD_BEGIN$1) {
    return element.end;
  } else if(element.type === SECTION$2 && element.elements.length > 0) {
    return lastIn(element.elements[element.elements.length - 1]);
  } else {
    return element
  }
};

const cursor = (instruction, range, position) => {
  const index = instruction.ranges[range][position];

  return {
    column: index - instruction.ranges.line[BEGIN],
    index: index,
    line: instruction.line
  };
};

const selection = (instruction, range, position, ...to) => {
  const toInstruction = to.find(argument => typeof argument === 'object') || instruction;
  const toRange = to.find(argument => typeof argument === 'string') || range;
  const toPosition = to.find(argument => typeof argument === 'number') || position;

  return {
    from: cursor(instruction, range, position),
    to: cursor(toInstruction, toRange, toPosition)
  };
};

const selectComments = element => {
  const { comments } = element;

  if(comments.length === 1) {
    if(comments[0].hasOwnProperty('comment')) {
      return selection(comments[0], 'comment', BEGIN, END);
    } else {
      return selection(comments[0], 'line', BEGIN, END);
    }
  } else if(comments.length > 1) {
    return selection(comments[0], 'line', BEGIN, comments[comments.length - 1], 'line', END);
  } else {
    return selection(element, 'line', BEGIN);
  }
};

var DOCUMENT_BEGIN = {
  from: { column: 0, index: 0, line: 0 },
  to: { column: 0, index: 0, line: 0 }
};

var cursor_1 = cursor;
var selection_1 = selection;
var selectComments_1 = selectComments;
var selectElement = element => selection(element, 'line', BEGIN, lastIn(element), 'line', END);
var selectKey = element => selection(element, 'key', BEGIN, END);
var selectLine = element => selection(element, 'line', BEGIN, END);
var selectTemplate = element => selection(element, 'template', BEGIN, END);

var selections = {
	DOCUMENT_BEGIN: DOCUMENT_BEGIN,
	cursor: cursor_1,
	selection: selection_1,
	selectComments: selectComments_1,
	selectElement: selectElement,
	selectKey: selectKey,
	selectLine: selectLine,
	selectTemplate: selectTemplate
};

const { BEGIN: BEGIN$1, DOCUMENT: DOCUMENT$1, END: END$1, HUMAN_INDEXING: HUMAN_INDEXING$1 } = constants;
const { cursor: cursor$1, selectLine: selectLine$1, selectTemplate: selectTemplate$1 } = selections;
const { ParseError: ParseError$1 } = error_types;

// ```key: value
const UNTERMINATED_ESCAPED_KEY = /^\s*#*\s*(`+)(?!`)((?:(?!\1).)+)$/;
const unterminatedEscapedKey = (context, instruction, unterminated) => {
  const line = context._input.substring(instruction.ranges.line[BEGIN$1], instruction.ranges.line[END$1]);
  const selectionColumn = line.lastIndexOf(unterminated);

  return new ParseError$1(
    context.messages.unterminatedEscapedKey(instruction.line + HUMAN_INDEXING$1),
    new context.reporter(context).reportLine(instruction).snippet(),
    { from: { column: selectionColumn, index: instruction.ranges.line[0] + selectionColumn, line: instruction.line }, to: cursor$1(instruction, 'line', END$1) }
  );
};

var errors = {
  cyclicDependency: (context, instruction, instructionChain) => {
    const firstOccurrence = instructionChain.indexOf(instruction);
    const feedbackChain = instructionChain.slice(firstOccurrence);

    const firstInstruction = feedbackChain[0];
    const lastInstruction = feedbackChain[feedbackChain.length - 1];

    let copyInstruction;
    if(lastInstruction.hasOwnProperty('template')) {
      copyInstruction = lastInstruction;
    } else if(firstInstruction.hasOwnProperty('template')) {
      copyInstruction = firstInstruction;
    }

    const reporter = new context.reporter(context);

    reporter.reportLine(copyInstruction);

    for(const element of feedbackChain) {
      if(element !== copyInstruction) {
        reporter.indicateLine(element);
      }
    }

    return new ParseError$1(
      context.messages.cyclicDependency(copyInstruction.line + HUMAN_INDEXING$1, copyInstruction.template),
      reporter.snippet(),
      selectTemplate$1(copyInstruction)
    );
  },

  invalidLine: (context, instruction) => {
    const line = context._input.substring(instruction.ranges.line[BEGIN$1], instruction.ranges.line[END$1]);

    let match;
    if( (match = UNTERMINATED_ESCAPED_KEY.exec(line)) ) {
      return unterminatedEscapedKey(context, instruction, match[2]);
    }

    // TODO: This is a reoccurring pattern and can be DRYed up - line_error or something
    //       (Also in other implementations)
    return new ParseError$1(
      context.messages.invalidLine(instruction.line + HUMAN_INDEXING$1),
      new context.reporter(context).reportLine(instruction).snippet(),
      selectLine$1(instruction)
    );
  },

  missingElementForContinuation: (context, continuation) => {
    return new ParseError$1(
      context.messages.missingElementForContinuation(continuation.line + HUMAN_INDEXING$1),
      new context.reporter(context).reportLine(continuation).snippet(),
      selectLine$1(continuation)
    );
  },

  missingFieldsetForFieldsetEntry: (context, entry) => {
    return new ParseError$1(
      context.messages.missingFieldsetForFieldsetEntry(entry.line + HUMAN_INDEXING$1),
      new context.reporter(context).reportLine(entry).snippet(),
      selectLine$1(entry)
    );
  },

  missingListForListItem: (context, item) => {
    return new ParseError$1(
      context.messages.missingListForListItem(item.line + HUMAN_INDEXING$1),
      new context.reporter(context).reportLine(item).snippet(),
      selectLine$1(item)
    );
  },

  nonSectionElementNotFound: (context, copy) => {
    return new ParseError$1(
      context.messages.nonSectionElementNotFound(copy.line + HUMAN_INDEXING$1, copy.template),
      new context.reporter(context).reportLine(copy).snippet(),
      selectLine$1(copy)
    );
  },

  sectionHierarchyLayerSkip: (context, section, superSection) => {
    const reporter = new context.reporter(context).reportLine(section);

    if(superSection.type !== DOCUMENT$1) {
      reporter.indicateLine(superSection);
    }

    return new ParseError$1(
      context.messages.sectionHierarchyLayerSkip(section.line + HUMAN_INDEXING$1),
      reporter.snippet(),
      selectLine$1(section)
    );
  },

  sectionNotFound: (context, copy) => {
    return new ParseError$1(
      context.messages.sectionNotFound(copy.line + HUMAN_INDEXING$1, copy.template),
      new context.reporter(context).reportLine(copy).snippet(),
      selectLine$1(copy)
    );
  },

  twoOrMoreTemplatesFound: (context, copy, firstTemplate, secondTemplate) => {
    return new ParseError$1(
      context.messages.twoOrMoreTemplatesFound(copy.template),
      new context.reporter(context).reportLine(copy).questionLine(firstTemplate).questionLine(secondTemplate).snippet(),
      selectLine$1(copy)
    );
  },

  unterminatedMultilineField: (context, field) => {
    return new ParseError$1(
      context.messages.unterminatedMultilineField(field.key, field.line + HUMAN_INDEXING$1),
      new context.reporter(context).reportElement(field).snippet(),
      selectLine$1(field)
    );
  }
};

var parsing = {
	errors: errors
};

// Note: Study this file from the bottom up

const OPTIONAL = '([^\\n]+?)?';
const REQUIRED = '(\\S[^\\n]*?)';

//
const EMPTY_LINE = '()';
var EMPTY_LINE_INDEX = 1;

// | value
const DIRECT_LINE_CONTINUATION = `(\\|)[^\\S\\n]*${OPTIONAL}`;
var DIRECT_LINE_CONTINUATION_OPERATOR_INDEX = 2;
var DIRECT_LINE_CONTINUATION_VALUE_INDEX = 3;

// \ value
const SPACED_LINE_CONTINUATION = `(\\\\)[^\\S\\n]*${OPTIONAL}`;
var SPACED_LINE_CONTINUATION_OPERATOR_INDEX = 4;
var SPACED_LINE_CONTINUATION_VALUE_INDEX = 5;

const CONTINUATION = `${DIRECT_LINE_CONTINUATION}|${SPACED_LINE_CONTINUATION}`;

// > comment
const COMMENT = `(>)[^\\S\\n]*${OPTIONAL}`;
var COMMENT_OPERATOR_INDEX = 6;
var COMMENT_INDEX = 7;

// - value
const LIST_ITEM$2 = `(-)(?!-)[^\\S\\n]*${OPTIONAL}`;
var LIST_ITEM_OPERATOR_INDEX = 8;
var LIST_ITEM_VALUE_INDEX = 9;

// -- key
const MULTILINE_FIELD = `(-{2,})(?!-)[^\\S\\n]*${REQUIRED}`;
var MULTILINE_FIELD_OPERATOR_INDEX = 10;
var MULTILINE_FIELD_KEY_INDEX = 11;

// #
const SECTION_OPERATOR = '(#+)(?!#)';
var SECTION_OPERATOR_INDEX = 12;

// # key
const SECTION_KEY_UNESCAPED = '([^`\\s<][^<\\n]*?)';
var SECTION_KEY_UNESCAPED_INDEX = 13;

// # `key`
const SECTION_KEY_ESCAPE_BEGIN_OPERATOR_INDEX = 14;
const SECTION_KEY_ESCAPED = `(\`+)(?!\`)[^\\S\\n]*(\\S[^\\n]*?)[^\\S\\n]*\\${SECTION_KEY_ESCAPE_BEGIN_OPERATOR_INDEX}`; // TODO: Should this exclude the backreference inside the quotes? (as in ((?:(?!\\1).)+) ) here and elsewhere (probably not because it's not greedy.?)
var SECTION_KEY_ESCAPE_BEGIN_OPERATOR_INDEX_1 = SECTION_KEY_ESCAPE_BEGIN_OPERATOR_INDEX;
var SECTION_KEY_ESCAPED_INDEX = 15;

// # key <(<) template
// # `key` <(<) template
const SECTION_KEY = `(?:${SECTION_KEY_UNESCAPED}|${SECTION_KEY_ESCAPED})`;
const SECTION_TEMPLATE = `(?:(<(?!<)|<<)[^\\S\\n]*${REQUIRED})?`;
const SECTION$3 = `${SECTION_OPERATOR}\\s*${SECTION_KEY}[^\\S\\n]*${SECTION_TEMPLATE}`;
var SECTION_COPY_OPERATOR_INDEX = 16;
var SECTION_TEMPLATE_INDEX = 17;

const EARLY_DETERMINED = `${CONTINUATION}|${COMMENT}|${LIST_ITEM$2}|${MULTILINE_FIELD}|${SECTION$3}`;

// key
const KEY_UNESCAPED = '([^\\s>#\\-`\\\\|:=<][^:=<\\n]*?)';
var KEY_UNESCAPED_INDEX = 18;

// `key`
const KEY_ESCAPE_BEGIN_OPERATOR_INDEX = 19;
const KEY_ESCAPED = `(\`+)(?!\`)[^\\S\\n]*(\\S[^\\n]*?)[^\\S\\n]*\\${KEY_ESCAPE_BEGIN_OPERATOR_INDEX}`;
var KEY_ESCAPE_BEGIN_OPERATOR_INDEX_1 = KEY_ESCAPE_BEGIN_OPERATOR_INDEX;
var KEY_ESCAPED_INDEX = 20;

const KEY = `(?:${KEY_UNESCAPED}|${KEY_ESCAPED})`;

// :
// : value
const FIELD_OR_FIELDSET_OR_LIST = `(:)[^\\S\\n]*${OPTIONAL}`;
var ELEMENT_OPERATOR_INDEX = 21;
var FIELD_VALUE_INDEX = 22;

// =
// = value
const FIELDSET_ENTRY$2 = `(=)[^\\S\\n]*${OPTIONAL}`;
var FIELDSET_ENTRY_OPERATOR_INDEX = 23;
var FIELDSET_ENTRY_VALUE_INDEX = 24;

// < template
const TEMPLATE = `<\\s*${REQUIRED}`;
var TEMPLATE_INDEX = 25;

const LATE_DETERMINED = `${KEY}\\s*(?:${FIELD_OR_FIELDSET_OR_LIST}|${FIELDSET_ENTRY$2}|${TEMPLATE})?`;

const NON_EMPTY_LINE = `(?:${EARLY_DETERMINED}|${LATE_DETERMINED})`;

var GRAMMAR_REGEXP = new RegExp(`[^\\S\\n]*(?:${EMPTY_LINE}|${NON_EMPTY_LINE})[^\\S\\n]*(?=\\n|$)`, 'y');

var grammar_matcher = {
	EMPTY_LINE_INDEX: EMPTY_LINE_INDEX,
	DIRECT_LINE_CONTINUATION_OPERATOR_INDEX: DIRECT_LINE_CONTINUATION_OPERATOR_INDEX,
	DIRECT_LINE_CONTINUATION_VALUE_INDEX: DIRECT_LINE_CONTINUATION_VALUE_INDEX,
	SPACED_LINE_CONTINUATION_OPERATOR_INDEX: SPACED_LINE_CONTINUATION_OPERATOR_INDEX,
	SPACED_LINE_CONTINUATION_VALUE_INDEX: SPACED_LINE_CONTINUATION_VALUE_INDEX,
	COMMENT_OPERATOR_INDEX: COMMENT_OPERATOR_INDEX,
	COMMENT_INDEX: COMMENT_INDEX,
	LIST_ITEM_OPERATOR_INDEX: LIST_ITEM_OPERATOR_INDEX,
	LIST_ITEM_VALUE_INDEX: LIST_ITEM_VALUE_INDEX,
	MULTILINE_FIELD_OPERATOR_INDEX: MULTILINE_FIELD_OPERATOR_INDEX,
	MULTILINE_FIELD_KEY_INDEX: MULTILINE_FIELD_KEY_INDEX,
	SECTION_OPERATOR_INDEX: SECTION_OPERATOR_INDEX,
	SECTION_KEY_UNESCAPED_INDEX: SECTION_KEY_UNESCAPED_INDEX,
	SECTION_KEY_ESCAPE_BEGIN_OPERATOR_INDEX: SECTION_KEY_ESCAPE_BEGIN_OPERATOR_INDEX_1,
	SECTION_KEY_ESCAPED_INDEX: SECTION_KEY_ESCAPED_INDEX,
	SECTION_COPY_OPERATOR_INDEX: SECTION_COPY_OPERATOR_INDEX,
	SECTION_TEMPLATE_INDEX: SECTION_TEMPLATE_INDEX,
	KEY_UNESCAPED_INDEX: KEY_UNESCAPED_INDEX,
	KEY_ESCAPE_BEGIN_OPERATOR_INDEX: KEY_ESCAPE_BEGIN_OPERATOR_INDEX_1,
	KEY_ESCAPED_INDEX: KEY_ESCAPED_INDEX,
	ELEMENT_OPERATOR_INDEX: ELEMENT_OPERATOR_INDEX,
	FIELD_VALUE_INDEX: FIELD_VALUE_INDEX,
	FIELDSET_ENTRY_OPERATOR_INDEX: FIELDSET_ENTRY_OPERATOR_INDEX,
	FIELDSET_ENTRY_VALUE_INDEX: FIELDSET_ENTRY_VALUE_INDEX,
	TEMPLATE_INDEX: TEMPLATE_INDEX,
	GRAMMAR_REGEXP: GRAMMAR_REGEXP
};

const { errors: errors$1 } = parsing;

const {
  COMMENT: COMMENT$1,
  CONTINUATION: CONTINUATION$1,
  DOCUMENT: DOCUMENT$2,
  EMPTY,
  END: END$2,
  FIELD: FIELD$2,
  FIELDSET: FIELDSET$2,
  FIELDSET_ENTRY: FIELDSET_ENTRY$3,
  FIELD_OR_FIELDSET_OR_LIST: FIELD_OR_FIELDSET_OR_LIST$1,
  LIST: LIST$2,
  LIST_ITEM: LIST_ITEM$3,
  MULTILINE_FIELD_BEGIN: MULTILINE_FIELD_BEGIN$2,
  MULTILINE_FIELD_END,
  MULTILINE_FIELD_VALUE,
  SECTION: SECTION$4,
  UNPARSED
} = constants;

const parseAfterError = (context, index, line, errorInstruction = null) => {
  if(errorInstruction) {
    context._meta.push(errorInstruction);
    index = errorInstruction.ranges.line[END$2];
    line++;
  }

  while(index < context._input.length) {
    let endOfLineIndex = context._input.indexOf('\n', index);

    if(endOfLineIndex === -1) {
      endOfLineIndex = context._input.length;
    }

    const instruction = {
      line: line,
      ranges: { line: [index, endOfLineIndex] },
      type: UNPARSED
    };

    if(errorInstruction === null) {
      errorInstruction = instruction;
    }

    context._meta.push(instruction);
    index = endOfLineIndex + 1;
    line++;
  }

  context._lineCount = context._input[context._input.length - 1] === '\n' ? line + 1 : line;

  return errorInstruction;
};

var analyze_1 = function() {
  this._document = {
    depth: 0,
    elements: [],
    type: DOCUMENT$2
  };

  // TODO: Possibly flatten into two properties?
  this.copy = {
    nonSectionElements: {},
    sections: {}
  };

  this._meta = [];

  if(this._input.length === 0) {
    this._lineCount = 1;
    return;
  }

  let comments = null;
  let lastContinuableElement = null;
  let lastNonSectionElement = null;
  let lastSection = this._document;

  let index = 0;
  let line = 0;
  const matcherRegex = grammar_matcher.GRAMMAR_REGEXP;
  matcherRegex.lastIndex = index;

  let instruction;

  while(index < this._input.length) {
    const match = matcherRegex.exec(this._input);

    if(match === null) {
      instruction = parseAfterError(this, index, line);
      throw errors$1.invalidLine(this, instruction);
    } else {
      instruction = {
        line: line,
        ranges: {
          line: [index, matcherRegex.lastIndex]
        }
      };
    }

    if(match[grammar_matcher.EMPTY_LINE_INDEX] !== undefined) {

      if(comments) {
        this._meta.push(...comments);
        comments = null;
      }

    } else if(match[grammar_matcher.ELEMENT_OPERATOR_INDEX] !== undefined) {

      if(comments) {
        instruction.comments = comments;
        comments = null;
      }

      instruction.key = match[grammar_matcher.KEY_UNESCAPED_INDEX];

      let elementOperatorIndex;
      if(instruction.key !== undefined) {
        const keyIndex = this._input.indexOf(instruction.key, index);
        elementOperatorIndex = this._input.indexOf(':', keyIndex + instruction.key.length);

        instruction.ranges.elementOperator = [elementOperatorIndex, elementOperatorIndex + 1];
        instruction.ranges.key = [keyIndex, keyIndex + instruction.key.length];
      } else {
        instruction.key = match[grammar_matcher.KEY_ESCAPED_INDEX];

        const escapeOperator = match[grammar_matcher.KEY_ESCAPE_BEGIN_OPERATOR_INDEX];
        const escapeBeginOperatorIndex = this._input.indexOf(escapeOperator, index);
        const keyIndex = this._input.indexOf(instruction.key, escapeBeginOperatorIndex + escapeOperator.length);
        const escapeEndOperatorIndex = this._input.indexOf(escapeOperator, keyIndex + instruction.key.length);
        elementOperatorIndex = this._input.indexOf(':', escapeEndOperatorIndex + escapeOperator.length);

        instruction.ranges.escapeBeginOperator = [escapeBeginOperatorIndex, escapeBeginOperatorIndex + escapeOperator.length];
        instruction.ranges.escapeEndOperator = [escapeEndOperatorIndex, escapeEndOperatorIndex + escapeOperator.length];
        instruction.ranges.elementOperator = [elementOperatorIndex, elementOperatorIndex + 1];
        instruction.ranges.key = [keyIndex, keyIndex + instruction.key.length];
      }

      const value = match[grammar_matcher.FIELD_VALUE_INDEX];
      if(value) {
        instruction.continuations = [];
        instruction.type = FIELD$2;
        instruction.value = value;

        const valueIndex = this._input.indexOf(value, elementOperatorIndex + 1);
        instruction.ranges.value = [valueIndex, valueIndex + value.length];
      } else {
        instruction.type = FIELD_OR_FIELDSET_OR_LIST$1;
      }

      instruction.parent = lastSection;
      lastSection.elements.push(instruction);
      lastContinuableElement = instruction;
      lastNonSectionElement = instruction;

    } else if(match[grammar_matcher.LIST_ITEM_OPERATOR_INDEX] !== undefined) {

      if(comments) {
        instruction.comments = comments;
        comments = null;
      }

      instruction.continuations = [];  // TODO: Forward allocation of this kind is planned to be removed like in python implementation
      instruction.type = LIST_ITEM$3;
      instruction.value = match[grammar_matcher.LIST_ITEM_VALUE_INDEX] || null;

      const operatorIndex = this._input.indexOf('-', index);

      instruction.ranges.itemOperator = [operatorIndex, operatorIndex + 1];

      if(instruction.value) {
        const valueIndex = this._input.indexOf(instruction.value, operatorIndex + 1);
        instruction.ranges.value = [valueIndex, valueIndex + instruction.value.length];
      }

      if(lastNonSectionElement === null) {
        parseAfterError(this, index, line, instruction);
        throw errors$1.missingListForListItem(this, instruction);
      } else if(lastNonSectionElement.type === LIST$2) {
        lastNonSectionElement.items.push(instruction);
      } else if(lastNonSectionElement.type === FIELD_OR_FIELDSET_OR_LIST$1) {
        lastNonSectionElement.items = [instruction];
        lastNonSectionElement.type = LIST$2;
      } else {
        parseAfterError(this, index, line, instruction);
        throw errors$1.missingListForListItem(this, instruction);
      }

      instruction.parent = lastNonSectionElement;
      lastContinuableElement = instruction;

    } else if(match[grammar_matcher.FIELDSET_ENTRY_OPERATOR_INDEX] !== undefined) {

      if(comments) {
        instruction.comments = comments;
        comments = null;
      }

      instruction.continuations = []; // TODO: Only create ad-hoc, remove here and elsewhere, generally follow this pattern of allocation sparsity
      instruction.type = FIELDSET_ENTRY$3;

      let entryOperatorIndex;

      if(match[grammar_matcher.KEY_UNESCAPED_INDEX] === undefined) {
        instruction.key = match[grammar_matcher.KEY_ESCAPED_INDEX];

        const escapeOperator = match[grammar_matcher.KEY_ESCAPE_BEGIN_OPERATOR_INDEX];
        const escapeBeginOperatorIndex = this._input.indexOf(escapeOperator, index);
        const keyIndex = this._input.indexOf(instruction.key, escapeBeginOperatorIndex + escapeOperator.length);
        const escapeEndOperatorIndex = this._input.indexOf(escapeOperator, keyIndex + instruction.key.length);
        entryOperatorIndex = this._input.indexOf('=', escapeEndOperatorIndex + escapeOperator.length);

        instruction.ranges.escapeBeginOperator = [escapeBeginOperatorIndex, escapeBeginOperatorIndex + escapeOperator.length];
        instruction.ranges.escapeEndOperator = [escapeEndOperatorIndex, escapeEndOperatorIndex + escapeOperator.length];
        instruction.ranges.entryOperator = [entryOperatorIndex, entryOperatorIndex + 1];
        instruction.ranges.key = [keyIndex, keyIndex + instruction.key.length];
      } else {
        instruction.key = match[grammar_matcher.KEY_UNESCAPED_INDEX];

        const keyIndex = this._input.indexOf(instruction.key, index);
        entryOperatorIndex = this._input.indexOf('=', keyIndex + instruction.key.length);

        instruction.ranges.entryOperator = [entryOperatorIndex, entryOperatorIndex + 1];
        instruction.ranges.key = [keyIndex, keyIndex + instruction.key.length];
      }

      if(match[grammar_matcher.FIELDSET_ENTRY_VALUE_INDEX] === undefined) {
        instruction.value = null;
      } else {
        instruction.value = match[grammar_matcher.FIELDSET_ENTRY_VALUE_INDEX];

        const valueIndex = this._input.indexOf(instruction.value, entryOperatorIndex + 1);
        instruction.ranges.value = [valueIndex, valueIndex + instruction.value.length];
      }

      if(lastNonSectionElement === null) {
        parseAfterError(this, index, line, instruction);
        throw errors$1.missingFieldsetForFieldsetEntry(this, instruction);
      } else if(lastNonSectionElement.type === FIELDSET$2) {
        lastNonSectionElement.entries.push(instruction);
      } else if(lastNonSectionElement.type === FIELD_OR_FIELDSET_OR_LIST$1) {
        lastNonSectionElement.entries = [instruction];
        lastNonSectionElement.type = FIELDSET$2;
      } else {
        parseAfterError(this, index, line, instruction);
        throw errors$1.missingFieldsetForFieldsetEntry(this, instruction);
      }

      instruction.parent = lastNonSectionElement;
      lastContinuableElement = instruction;

    } else if(match[grammar_matcher.SPACED_LINE_CONTINUATION_OPERATOR_INDEX] !== undefined) {

      instruction.spaced = true;
      instruction.type = CONTINUATION$1;

      const operatorIndex = this._input.indexOf('\\', index);
      instruction.ranges.spacedLineContinuationOperator = [operatorIndex, operatorIndex + 1];

      if(match[grammar_matcher.SPACED_LINE_CONTINUATION_VALUE_INDEX] === undefined) {
        instruction.value = null;
      } else {
        instruction.value = match[grammar_matcher.SPACED_LINE_CONTINUATION_VALUE_INDEX];

        const valueIndex = this._input.indexOf(instruction.value, operatorIndex + 1);
        instruction.ranges.value = [valueIndex, valueIndex + instruction.value.length];
      }

      if(lastContinuableElement === null) {
        parseAfterError(this, index, line, instruction);
        throw errors$1.missingElementForContinuation(this, instruction);
      }

      if(lastContinuableElement.type === FIELD_OR_FIELDSET_OR_LIST$1) {
        lastContinuableElement.continuations = [instruction];
        lastContinuableElement.type = FIELD$2;
      } else {
        lastContinuableElement.continuations.push(instruction);
      }

      if(comments) {
        this._meta.push(...comments);
        comments = null;
      }


    } else if(match[grammar_matcher.DIRECT_LINE_CONTINUATION_OPERATOR_INDEX] !== undefined) {

      instruction.spaced = false;  // TODO: Just leave out
      instruction.type = CONTINUATION$1;

      const operatorIndex = this._input.indexOf('|', index);
      instruction.ranges.directLineContinuationOperator = [operatorIndex, operatorIndex + 1];

      if(match[grammar_matcher.DIRECT_LINE_CONTINUATION_VALUE_INDEX] !== undefined) {
        instruction.value = match[grammar_matcher.DIRECT_LINE_CONTINUATION_VALUE_INDEX];
        const valueIndex = this._input.indexOf(instruction.value, operatorIndex + 1);
        instruction.ranges.value = [valueIndex, valueIndex + instruction.value.length];
      } else {
        instruction.value = null;
      }

      if(lastContinuableElement === null) {
        parseAfterError(this, index, line, instruction);
        throw errors$1.missingElementForContinuation(this, instruction);
      }

      if(lastContinuableElement.type === FIELD_OR_FIELDSET_OR_LIST$1) {
        lastContinuableElement.continuations = [instruction];
        lastContinuableElement.type = FIELD$2;
      } else {
        lastContinuableElement.continuations.push(instruction);
      }

      if(comments) {
        this._meta.push(...comments);
        comments = null;
      }

    } else if(match[grammar_matcher.SECTION_OPERATOR_INDEX] !== undefined) {

      if(comments) {
        instruction.comments = comments;
        comments = null;
      }

      const sectionOperator = match[grammar_matcher.SECTION_OPERATOR_INDEX];

      instruction.depth = sectionOperator.length;
      instruction.elements = [];
      instruction.type = SECTION$4;

      const sectionOperatorIndex = this._input.indexOf(sectionOperator, index);
      instruction.key = match[grammar_matcher.SECTION_KEY_UNESCAPED_INDEX];
      let keyEndIndex;

      if(instruction.key !== undefined) {
        const keyIndex = this._input.indexOf(instruction.key, sectionOperatorIndex + sectionOperator.length);
        keyEndIndex = keyIndex + instruction.key.length;

        instruction.ranges.key = [keyIndex, keyIndex + instruction.key.length];
        instruction.ranges.sectionOperator = [sectionOperatorIndex, sectionOperatorIndex + sectionOperator.length];
      } else {
        instruction.key = match[grammar_matcher.SECTION_KEY_ESCAPED_INDEX];

        const escapeOperator = match[grammar_matcher.SECTION_KEY_ESCAPE_BEGIN_OPERATOR_INDEX];
        const escapeBeginOperatorIndex = this._input.indexOf(escapeOperator, sectionOperatorIndex + sectionOperator.length);
        const keyIndex = this._input.indexOf(instruction.key, escapeBeginOperatorIndex + escapeOperator.length);
        const escapeEndOperatorIndex = this._input.indexOf(escapeOperator, keyIndex + instruction.key.length);
        keyEndIndex = escapeEndOperatorIndex + escapeOperator.length;

        instruction.ranges.escapeBeginOperator = [escapeBeginOperatorIndex, escapeBeginOperatorIndex + escapeOperator.length];
        instruction.ranges.escapeEndOperator = [escapeEndOperatorIndex, escapeEndOperatorIndex + escapeOperator.length];
        instruction.ranges.key = [keyIndex, keyIndex + instruction.key.length];
        instruction.ranges.sectionOperator = [sectionOperatorIndex, sectionOperatorIndex + sectionOperator.length];
      }

      if(match[grammar_matcher.SECTION_TEMPLATE_INDEX] !== undefined) {
        instruction.template = match[grammar_matcher.SECTION_TEMPLATE_INDEX];

        const copyOperator = match[grammar_matcher.SECTION_COPY_OPERATOR_INDEX];
        const copyOperatorIndex = this._input.indexOf(copyOperator, keyEndIndex);
        const templateIndex = this._input.indexOf(instruction.template, copyOperatorIndex + copyOperator.length);

        instruction.deepCopy = copyOperator.length > 1;

        if(instruction.deepCopy) {
          instruction.ranges.deepCopyOperator = [copyOperatorIndex, copyOperatorIndex + copyOperator.length];
        } else {
          instruction.ranges.copyOperator = [copyOperatorIndex, copyOperatorIndex + copyOperator.length];
        }

        instruction.ranges.template = [templateIndex, templateIndex + instruction.template.length];

        if(this.copy.sections.hasOwnProperty(instruction.template)) {
          this.copy.sections[instruction.template].targets.push(instruction);
        } else {
          this.copy.sections[instruction.template] = { targets: [instruction] };
        }

        instruction.copy = this.copy.sections[instruction.template];
      }

      if(instruction.depth === lastSection.depth + 1) {
        instruction.parent = lastSection;
      } else if(instruction.depth === lastSection.depth) {
        instruction.parent = lastSection.parent;
      } else if(instruction.depth < lastSection.depth) {
        while(instruction.depth < lastSection.depth) {
          lastSection = lastSection.parent;
        }

        instruction.parent = lastSection.parent;
      } else {
        parseAfterError(this, index, line, instruction);
        throw errors$1.sectionHierarchyLayerSkip(this, instruction, lastSection);
      }

      instruction.parent.elements.push(instruction);

      if(instruction.hasOwnProperty('template')) {
        for(let parent = instruction.parent; parent.type !== DOCUMENT$2; parent = parent.parent) {
          parent.deepResolve = true;
        }
      }

      lastSection = instruction;
      lastContinuableElement = null;
      lastNonSectionElement = null; // TODO: Actually wrong terminology - it's a Field/List/Fieldset but can't be List Item or Fieldset Entry!

    } else if(match[grammar_matcher.MULTILINE_FIELD_OPERATOR_INDEX] !== undefined) {

      if(comments) {
        instruction.comments = comments;
        comments = null;
      }

      const operator = match[grammar_matcher.MULTILINE_FIELD_OPERATOR_INDEX];

      instruction.key = match[grammar_matcher.MULTILINE_FIELD_KEY_INDEX];
      instruction.lines = [];
      instruction.type = MULTILINE_FIELD_BEGIN$2;

      let operatorIndex = this._input.indexOf(operator, index);
      let keyIndex = this._input.indexOf(instruction.key, operatorIndex + operator.length);

      instruction.ranges.multilineFieldOperator = [operatorIndex, operatorIndex + operator.length];
      instruction.ranges.key = [keyIndex, keyIndex + instruction.key.length];

      index = matcherRegex.lastIndex + 1;
      line += 1;

      instruction.parent = lastSection;
      lastSection.elements.push(instruction);

      lastContinuableElement = null;
      lastNonSectionElement = instruction;

      const keyEscaped = instruction.key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const terminatorMatcher = new RegExp(`[^\\S\\n]*(${operator})(?!-)[^\\S\\n]*(${keyEscaped})[^\\S\\n]*(?=\\n|$)`, 'y');

      while(true) {
        terminatorMatcher.lastIndex = index;
        let terminatorMatch = terminatorMatcher.exec(this._input);

        if(terminatorMatch) {
          operatorIndex = this._input.indexOf(operator, index);
          keyIndex = this._input.indexOf(instruction.key, operatorIndex + operator.length);

          instruction = {
            line: line,
            ranges: {
              line: [index, terminatorMatcher.lastIndex],
              multilineFieldOperator: [operatorIndex, operatorIndex + operator.length],
              key: [keyIndex, keyIndex + instruction.key.length]
            },
            type: MULTILINE_FIELD_END
          };

          lastNonSectionElement.end = instruction;
          lastNonSectionElement = null;

          matcherRegex.lastIndex = terminatorMatcher.lastIndex;

          break;
        } else {
          const endofLineIndex = this._input.indexOf('\n', index);

          if(endofLineIndex === -1) {
            lastNonSectionElement.lines.push({
              line: line,
              ranges: {
                line: [index, this._input.length],
                value: [index, this._input.length]  // TODO: line range === value range, drop value range? (see how the custom terminal reporter eg. handles this for syntax coloring, then revisit)
              },
              type: MULTILINE_FIELD_VALUE
            });

            throw errors$1.unterminatedMultilineField(this, instruction);
          } else {
            lastNonSectionElement.lines.push({
              line: line,
              ranges: {
                line: [index, endofLineIndex],
                value: [index, endofLineIndex]  // TODO: line range === value range, drop value range? (see how the custom terminal reporter eg. handles this for syntax coloring, then revisit)
              },
              type: MULTILINE_FIELD_VALUE
            });

            index = endofLineIndex + 1;
            line++;
          }
        }
      }

    } else if(match[grammar_matcher.TEMPLATE_INDEX] !== undefined) {

      if(comments) {
        instruction.comments = comments;
        comments = null;
      }

      instruction.template = match[grammar_matcher.TEMPLATE_INDEX]; // TODO: We can possibly make this ephemeral (local variable) because the new copyData reference replaces its function
      instruction.type = FIELD_OR_FIELDSET_OR_LIST$1;

      let copyOperatorIndex;

      instruction.key = match[grammar_matcher.KEY_UNESCAPED_INDEX];

      if(instruction.key !== undefined) {
        const keyIndex = this._input.indexOf(instruction.key, index);
        instruction.ranges.key = [keyIndex, keyIndex + instruction.key.length];

        copyOperatorIndex = this._input.indexOf('<', keyIndex + instruction.key.length);
      } else {
        instruction.key = match[grammar_matcher.KEY_ESCAPED_INDEX];

        const escapeOperator = match[grammar_matcher.KEY_ESCAPE_BEGIN_OPERATOR_INDEX];
        const escapeBeginOperatorIndex = this._input.indexOf(escapeOperator, index);
        const keyIndex = this._input.indexOf(instruction.key, escapeBeginOperatorIndex + escapeOperator.length);
        const escapeEndOperatorIndex = this._input.indexOf(escapeOperator, keyIndex + instruction.key.length);

        instruction.ranges.escapeBeginOperator = [escapeBeginOperatorIndex, escapeBeginOperatorIndex + escapeOperator.length];
        instruction.ranges.key = [keyIndex, keyIndex + instruction.key.length];
        instruction.ranges.escapeEndOperator = [escapeEndOperatorIndex, escapeEndOperatorIndex + escapeOperator.length];

        copyOperatorIndex = this._input.indexOf('<', escapeEndOperatorIndex + escapeOperator.length);
      }

      instruction.ranges.copyOperator = [copyOperatorIndex, copyOperatorIndex + 1];

      const templateIndex = this._input.indexOf(instruction.template, copyOperatorIndex + 1);
      instruction.ranges.template = [templateIndex, templateIndex + instruction.template.length];

      instruction.parent = lastSection;
      lastSection.elements.push(instruction);
      lastContinuableElement = null;
      lastNonSectionElement = instruction;

      if(this.copy.nonSectionElements.hasOwnProperty(instruction.template)) {
        this.copy.nonSectionElements[instruction.template].targets.push(instruction);
      } else {
        this.copy.nonSectionElements[instruction.template] = { targets: [instruction] };
      }

      instruction.copy = this.copy.nonSectionElements[instruction.template];

    } else if(match[grammar_matcher.COMMENT_OPERATOR_INDEX] !== undefined) {

      if(comments === null) {
        comments = [instruction];
      } else {
        comments.push(instruction);
      }

      instruction.type = COMMENT$1;

      const operatorIndex = this._input.indexOf('>', index);
      instruction.ranges.commentOperator = [operatorIndex, operatorIndex + 1];

      if(match[grammar_matcher.COMMENT_INDEX] !== undefined) {
        instruction.comment = match[grammar_matcher.COMMENT_INDEX];

        const commentIndex = this._input.indexOf(instruction.comment, operatorIndex + 1);
        instruction.ranges.comment = [commentIndex, commentIndex + instruction.comment.length];
      } else {
        instruction.comment = null;
      }

    } else if(match[grammar_matcher.KEY_UNESCAPED_INDEX] !== undefined) {

      if(comments) {
        instruction.comments = comments;
        comments = null;
      }

      instruction.key = match[grammar_matcher.KEY_UNESCAPED_INDEX];
      instruction.type = EMPTY;

      const keyIndex = this._input.indexOf(instruction.key, index);

      instruction.ranges.key = [keyIndex, keyIndex + instruction.key.length];

      instruction.parent = lastSection;
      lastSection.elements.push(instruction);
      lastContinuableElement = null;
      lastNonSectionElement = instruction;

    } else if(match[grammar_matcher.KEY_ESCAPED_INDEX] !== undefined) {

      if(comments) {
        instruction.comments = comments;
        comments = null;
      }

      instruction.key = match[grammar_matcher.KEY_ESCAPED_INDEX];
      instruction.type = EMPTY;

      const escapeOperator = match[grammar_matcher.KEY_ESCAPE_BEGIN_OPERATOR_INDEX];
      const escapeBeginOperatorIndex = this._input.indexOf(escapeOperator, index);
      const keyIndex = this._input.indexOf(instruction.key, escapeBeginOperatorIndex + escapeOperator.length);
      const escapeEndOperatorIndex = this._input.indexOf(escapeOperator, keyIndex + instruction.key.length);

      instruction.ranges.escapeBeginOperator = [escapeBeginOperatorIndex, escapeBeginOperatorIndex + escapeOperator.length];
      instruction.ranges.escapeEndOperator = [escapeEndOperatorIndex, escapeEndOperatorIndex + escapeOperator.length];
      instruction.ranges.key = [keyIndex, keyIndex + instruction.key.length];

      instruction.parent = lastSection;
      lastSection.elements.push(instruction);
      lastContinuableElement = null;
      lastNonSectionElement = instruction;

    }

    line += 1;
    index = matcherRegex.lastIndex + 1;
    matcherRegex.lastIndex = index;
  } // ends while(index < this._input.length) {

  this._lineCount = this._input[this._input.length - 1] === '\n' ? line + 1 : line;

  if(comments) {
    this._meta.push(...comments);
  }
};

var analyze = {
	analyze: analyze_1
};

//  GENERATED ON 2019-06-18T08:50:41 - DO NOT EDIT MANUALLY

var en = {
  contentHeader: 'Content',
  expectedDocument: 'The document was expected.',
  expectedEmpty: 'An empty was expected.',
  expectedField: 'A field was expected.',
  expectedFields: 'Only fields were expected.',
  expectedFieldset: 'A fieldset was expected.',
  expectedFieldsetEntry: 'A fieldset entry was expected.',
  expectedFieldsets: 'Only fieldsets were expected.',
  expectedList: 'A list was expected.',
  expectedListItem: 'A list item was expected.',
  expectedLists: 'Only lists were expected.',
  expectedSection: 'A section was expected.',
  expectedSections: 'Only sections were expected.',
  expectedSingleElement: 'Only a single element was expected.',
  expectedSingleEmpty: 'Only a single empty was expected.',
  expectedSingleField: 'Only a single field was expected.',
  expectedSingleFieldset: 'Only a single fieldset was expected.',
  expectedSingleFieldsetEntry: 'Only a single fieldset entry was expected.',
  expectedSingleList: 'Only a single list was expected.',
  expectedSingleSection: 'Only a single section was expected.',
  gutterHeader: 'Line',
  missingComment: 'A required comment for this element is missing.',
  missingElement: 'A single element is required - it can have any key.',
  missingEmpty: 'A single empty is required - it can have any key.',
  missingField: 'A single field is required - it can have any key.',
  missingFieldset: 'A single fieldset is required - it can have any key.',
  missingFieldsetEntry: 'A single fieldset entry is required - it can have any key.',
  missingList: 'A single list is required - it can have any key.',
  missingSection: 'A single section is required - it can have any key.',
  unexpectedElement: 'This element was not expected, make sure it is at the right place in the document and that its key is not mis-typed.',
  commentError: (message) => `There is a problem with the comment of this element: ${message}`,
  cyclicDependency: (line, key) => `In line ${line} '${key}' is copied into itself.`,
  expectedEmptyWithKey: (key) => `An empty with the key '${key}' was expected.`,
  expectedFieldWithKey: (key) => `A field with the key '${key}' was expected.`,
  expectedFieldsWithKey: (key) => `Only fields with the key '${key}' were expected.`,
  expectedFieldsetWithKey: (key) => `A fieldset with the key '${key}' was expected.`,
  expectedFieldsetsWithKey: (key) => `Only fieldsets with the key '${key}' were expected.`,
  expectedListWithKey: (key) => `A list with the key '${key}' was expected.`,
  expectedListsWithKey: (key) => `Only lists with the key '${key}' were expected.`,
  expectedSectionWithKey: (key) => `A section with the key '${key}' was expected.`,
  expectedSectionsWithKey: (key) => `Only sections with the key '${key}' were expected.`,
  expectedSingleElementWithKey: (key) => `Only a single element with the key '${key}' was expected.`,
  expectedSingleEmptyWithKey: (key) => `Only a single empty with the key '${key}' was expected.`,
  expectedSingleFieldWithKey: (key) => `Only a single field with the key '${key}' was expected.`,
  expectedSingleFieldsetEntryWithKey: (key) => `Only a single fieldset entry with the key '${key}' was expected.`,
  expectedSingleFieldsetWithKey: (key) => `Only a single fieldset with the key '${key}' was expected.`,
  expectedSingleListWithKey: (key) => `Only a single list with the key '${key}' was expected.`,
  expectedSingleSectionWithKey: (key) => `Only a single section with the key '${key}' was expected.`,
  invalidLine: (line) => `Line ${line} does not follow any specified pattern.`,
  keyError: (message) => `There is a problem with the key of this element: ${message}`,
  missingElementForContinuation: (line) => `Line ${line} contains a line continuation without a continuable element being specified before.`,
  missingElementWithKey: (key) => `The element '${key}' is missing - in case it has been specified look for typos and also check for correct capitalization.`,
  missingEmptyWithKey: (key) => `The empty '${key}' is missing - in case it has been specified look for typos and also check for correct capitalization.`,
  missingFieldValue: (key) => `The field '${key}' must contain a value.`,
  missingFieldWithKey: (key) => `The field '${key}' is missing - in case it has been specified look for typos and also check for correct capitalization.`,
  missingFieldsetEntryValue: (key) => `The fieldset entry '${key}' must contain a value.`,
  missingFieldsetEntryWithKey: (key) => `The fieldset entry '${key}' is missing - in case it has been specified look for typos and also check for correct capitalization.`,
  missingFieldsetForFieldsetEntry: (line) => `Line ${line} contains a fieldset entry without a fieldset being specified before.`,
  missingFieldsetWithKey: (key) => `The fieldset '${key}' is missing - in case it has been specified look for typos and also check for correct capitalization.`,
  missingListForListItem: (line) => `Line ${line} contains a list item without a list being specified before.`,
  missingListItemValue: (key) => `The list '${key}' may not contain empty items.`,
  missingListWithKey: (key) => `The list '${key}' is missing - in case it has been specified look for typos and also check for correct capitalization.`,
  missingSectionWithKey: (key) => `The section '${key}' is missing - in case it has been specified look for typos and also check for correct capitalization.`,
  nonSectionElementNotFound: (line, key) => `In line ${line} the non-section element '${key}' should be copied, but it was not found.`,
  sectionHierarchyLayerSkip: (line) => `Line ${line} starts a section that is more than one level deeper than the current one.`,
  sectionNotFound: (line, key) => `In line ${line} the section '${key}' should be copied, but it was not found.`,
  twoOrMoreTemplatesFound: (key) => `There are at least two elements with the key '${key}' that qualify for being copied here, it is not clear which to copy.`,
  unterminatedEscapedKey: (line) => `In line ${line} the key of an element is escaped, but the escape sequence is not terminated until the end of the line.`,
  unterminatedMultilineField: (key, line) => `The multiline field '${key}' starting in line ${line} is not terminated until the end of the document.`,
  valueError: (message) => `There is a problem with the value of this element: ${message}`
};

const { errors: errors$2 } = parsing;
const {
  FIELD: FIELD$3,
  FIELDSET: FIELDSET$3,
  FIELD_OR_FIELDSET_OR_LIST: FIELD_OR_FIELDSET_OR_LIST$2,
  LIST: LIST$3,
  MULTILINE_FIELD_BEGIN: MULTILINE_FIELD_BEGIN$3,
  SECTION: SECTION$5
} = constants;

const consolidateNonSectionElements = (context, element, template) => {
  if(template.hasOwnProperty('comments') && !element.hasOwnProperty('comments')) {
    element.comments = template.comments;
  }

  if(element.type === FIELD_OR_FIELDSET_OR_LIST$2) {
    if(template.type === MULTILINE_FIELD_BEGIN$3) {
      element.type = FIELD$3;  // TODO: Revisit this - maybe should be MULTILINE_FIELD_COPY or something else - consider implications all around.
      mirror(element, template);
    } else if(template.type === FIELD$3) {
      element.type = FIELD$3;
      mirror(element, template);
    } else if(template.type === FIELDSET$3) {
      element.type = FIELDSET$3;
      mirror(element, template);
    } else if(template.type === LIST$3) {
      element.type = LIST$3;
      mirror(element, template);
    }
  } else if(element.type === FIELDSET$3) {
    if(template.type === FIELDSET$3) {
      element.extend = template;
    } else if(template.type === FIELD$3 ||
              template.type === LIST$3 ||
              template.type === MULTILINE_FIELD_BEGIN$3) {
      throw errors$2.missingFieldsetForFieldsetEntry(context, element.entries[0]);
    }
  } else if(element.type === LIST$3) {
    if(template.type === LIST$3) {
      element.extend = template;
    } else if(template.type === FIELD$3 ||
              template.type === FIELDSET$3 ||
              template.type === MULTILINE_FIELD_BEGIN$3) {
      throw errors$2.missingListForListItem(context, element.items[0]);
    }
  }
};

const consolidateSections = (context, section, template, deepMerge) => {
  if(template.hasOwnProperty('comments') && !section.hasOwnProperty('comments')) {
    section.comments = template.comments;
  }

  if(section.elements.length === 0) {
    mirror(section, template);
  } else {
    // TODO: Handle possibility of two templates (one hardcoded in the document, one implicitly derived through deep merging)
    //       Possibly also elswhere (e.g. up there in the mirror branch?)
    section.extend = template;

    if(!deepMerge) return;

    const mergeMap = {};

    for(const elementInstruction of section.elements) {
      if(elementInstruction.type !== SECTION$5 || mergeMap.hasOwnProperty(elementInstruction.key)) {
        mergeMap[elementInstruction.key] = false; // non-mergable (no section or multiple sections with same key)
      } else {
        mergeMap[elementInstruction.key] = { section: elementInstruction };
      }
    }

    for(const elementInstruction of template.elements) {
      if(mergeMap.hasOwnProperty(elementInstruction.key)) {
        const merger = mergeMap[elementInstruction.key];

        if(merger === false) continue;

        if(elementInstruction.type !== SECTION$5 || merger.hasOwnProperty('template')) {
          mergeMap[elementInstruction.key] = false; // non-mergable (no section or multiple template sections with same key)
        } else {
          merger.template = elementInstruction;
        }
      }
    }

    for(const merger of Object.values(mergeMap)) {
      if(merger === false) continue;
      // TODO: merger.template can be undefined if a section is applicable for
      //       merging but no matching merge template is present? (see python impl.)
      //       Note: No spec in js impl. reported this so far, unlike in python impl.
      consolidateSections(context, merger.section, merger.template, true);
    }
  }
};

const mirror = (element, template) => {
  if(template.hasOwnProperty('mirror')) {
    element.mirror = template.mirror;
  } else {
    element.mirror = template;
  }
};

const resolveNonSectionElement = (context, element, previousElements = []) => {
  if(previousElements.includes(element))
    throw errors$2.cyclicDependency(context, element, previousElements);

  const template = element.copy.template;

  if(template.hasOwnProperty('copy')) { // TODO: Maybe we change that to .unresolved everywhere ?
    resolveNonSectionElement(context, template, [...previousElements, element]);
  }

  consolidateNonSectionElements(context, element, template);

  delete element.copy;
};

const resolveSection = (context, section, previousSections = []) => {
  if(previousSections.includes(section))
    throw errors$2.cyclicDependency(context, section, previousSections);

  if(section.hasOwnProperty('deepResolve')) {
    for(const elementInstruction of section.elements) {
      if(elementInstruction.type === SECTION$5 && (elementInstruction.hasOwnProperty('copy') || elementInstruction.hasOwnProperty('deepResolve'))) {
        resolveSection(context, elementInstruction, [...previousSections, section]);
      }
    }

    delete section.deepResolve;
  }

  if(section.hasOwnProperty('copy')) {
    const template = section.copy.template;

    if(template.hasOwnProperty('copy') || template.hasOwnProperty('deepResolve')) {
      resolveSection(context, template, [...previousSections, section]);
    }

    consolidateSections(context, section, template, section.deepCopy);

    delete section.copy;
  }
};

const index = (context, section, indexNonSectionElements, indexSections) => {
  for(const elementInstruction of section.elements) {
    if(elementInstruction.type === SECTION$5) {
      index(context, elementInstruction, indexNonSectionElements, indexSections);

      if(indexSections &&
         context.copy.sections.hasOwnProperty(elementInstruction.key) &&
         elementInstruction.key !== elementInstruction.template) {
        const copyData = context.copy.sections[elementInstruction.key];

        if(copyData.hasOwnProperty('template'))
          throw errors$2.twoOrMoreTemplatesFound(context, copyData.targets[0], copyData.template, elementInstruction);

        copyData.template = elementInstruction;
      }
    } else if(indexNonSectionElements &&
              context.copy.nonSectionElements.hasOwnProperty(elementInstruction.key) &&
              elementInstruction.key !== elementInstruction.template) {
      const copyData = context.copy.nonSectionElements[elementInstruction.key];

      if(copyData.hasOwnProperty('template'))
        throw errors$2.twoOrMoreTemplatesFound(context, copyData.targets[0], copyData.template, elementInstruction);

      copyData.template = elementInstruction;
    }
  }
};

var resolve_1 = function() {
  const unresolvedNonSectionElements = Object.values(this.copy.nonSectionElements);
  const unresolvedSections = Object.values(this.copy.sections);

  if(unresolvedNonSectionElements.length > 0 || unresolvedSections.length > 0) {
    index(this, this._document, unresolvedNonSectionElements.length > 0, unresolvedSections.length > 0);

    for(const copy of unresolvedNonSectionElements) {
      if(!copy.hasOwnProperty('template'))
        throw errors$2.nonSectionElementNotFound(this, copy.targets[0]);

      for(const target of copy.targets) {
        if(!target.hasOwnProperty('copy')) continue;

        resolveNonSectionElement(this, target);
      }
    }

    for(const copy of unresolvedSections) {
      if(!copy.hasOwnProperty('template'))
        throw errors$2.sectionNotFound(this, copy.targets[0]);

      for(const target of copy.targets) {
        if(!target.hasOwnProperty('copy')) continue;

        resolveSection(this, target);
      }
    }
  }

  delete this.copy;
};

var resolve = {
	resolve: resolve_1
};

const { DISPLAY: DISPLAY$1, EMPHASIZE: EMPHASIZE$2, INDICATE: INDICATE$2, OMISSION: OMISSION$2, QUESTION: QUESTION$2, Reporter: Reporter$2 } = reporter;
const { HUMAN_INDEXING: HUMAN_INDEXING$2 } = constants;

const INDICATORS = {
  [DISPLAY$1]: ' ',
  [EMPHASIZE$2]: '>',
  [INDICATE$2]: '*',
  [QUESTION$2]: '?'
};

class TextReporter extends Reporter$2 {
  constructor(context) {
    super(context);

    const gutterHeader = this._context.messages.gutterHeader.padStart(5);
    const columnsHeader = `  ${gutterHeader} | ${this._context.messages.contentHeader}`;

    this._gutterWidth = gutterHeader.length + 3;
    this._header = `${context.source ? `-- ${context.source} --\n\n` : ''}${columnsHeader}\n`;
  }

  _line(line, tag) {
    if(tag === OMISSION$2)
      return `${' '.repeat(this._gutterWidth - 5)}...`;

    const number = (line + HUMAN_INDEXING$2).toString();
    const instruction = this._index[line];

    let content;
    if(instruction === undefined) {
      content = '';
    }  else {
      content = this._context._input.substring(instruction.ranges.line[0], instruction.ranges.line[1]);
    }

    return ` ${INDICATORS[tag]}${number.padStart(this._gutterWidth - 3)} | ${content}`;
  }

  _print() {
    const snippet = this._snippet.map((tag, line) => this._line(line, tag))
                                 .filter(line => line !== undefined)
                                 .join('\n');

    return this._header + snippet;
  }
}

var TextReporter_1 = TextReporter;

var text_reporter = {
	TextReporter: TextReporter_1
};

const { analyze: analyze$1 } = analyze;

const { resolve: resolve$1 } =  resolve;
const { TextReporter: TextReporter$1 } = text_reporter;

const {
  DOCUMENT: DOCUMENT$3,
  EMPTY: EMPTY$1,
  FIELD: FIELD$4,
  FIELDSET: FIELDSET$4,
  FIELDSET_ENTRY: FIELDSET_ENTRY$4,
  FIELD_OR_FIELDSET_OR_LIST: FIELD_OR_FIELDSET_OR_LIST$3,
  LIST: LIST$4,
  LIST_ITEM: LIST_ITEM$4,
  MULTILINE_FIELD_BEGIN: MULTILINE_FIELD_BEGIN$4,
  PRETTY_TYPES,
  SECTION: SECTION$6
} = constants;

class Context {
  constructor(input, options) {
    this._input = input;
    this.messages = options.hasOwnProperty('locale') ? options.locale : en;
    this.reporter = options.hasOwnProperty('reporter') ? options.reporter : TextReporter$1;
    this.source = options.hasOwnProperty('source') ? options.source : null;

    this._analyze();

    if(this.hasOwnProperty('copy')) {
      this._resolve();
    }
  }

  // TODO: Here and elsewhere - don't manually copy over copied comments field in resolve.js
  //       but instead also derive a copied comment in here, lazily, just as in this.value() ?
  comment(element) {
    if(!element.hasOwnProperty('computedComment')) {
      if(element.hasOwnProperty('comments')) {
        if(element.comments.length === 1) {
          element.computedComment = element.comments[0].comment;
        } else {
          let firstNonEmptyLineIndex = null;
          let sharedIndent = Infinity;
          let lastNonEmptyLineIndex = null;

          for(const [index, comment] of element.comments.entries()) {
            if(comment.comment !== null) {
              if(firstNonEmptyLineIndex == null) {
                firstNonEmptyLineIndex = index;
              }

              const indent = comment.ranges.comment[0] - comment.ranges.line[0];
              if(indent < sharedIndent) {
                sharedIndent = indent;
              }

              lastNonEmptyLineIndex = index;
            }
          }

          if(firstNonEmptyLineIndex !== null) {
            const nonEmptyLines = element.comments.slice(
              firstNonEmptyLineIndex,
              lastNonEmptyLineIndex + 1
            );

            element.computedComment = nonEmptyLines.map(comment => {
              if(comment.comment === null) {
                return '';
              } else if(comment.ranges.comment[0] - comment.ranges.line[0] === sharedIndent) {
                return comment.comment;
              } else {
                return ' '.repeat(comment.ranges.comment[0] - comment.ranges.line[0] - sharedIndent) + comment.comment;
              }
            }).join('\n');
          } else {
            element.computedComment = null;
          }
        }
      } else {
        element.computedComment = null;
      }
    }

    return element.computedComment;
  }

  elements(section) {
    if(section.hasOwnProperty('mirror')) {
      return this.elements(section.mirror);
    } else {
      if(!section.hasOwnProperty('computedElements')) {
        section.computedElementsMap = {};
        section.computedElements = section.elements;

        for(const element of section.computedElements) {
          if(section.computedElementsMap.hasOwnProperty(element.key)) {
            section.computedElementsMap[element.key].push(element);
          } else {
            section.computedElementsMap[element.key] = [element];
          }
        }

        if(section.hasOwnProperty('extend')) {
          const copiedElements = this.elements(section.extend).filter(element =>
            !section.computedElementsMap.hasOwnProperty(element.key)
          );

          section.computedElements = copiedElements.concat(section.computedElements);  // TODO: .push(...xy) somehow possible too? (but careful about order, which is relevant)

          for(const element of copiedElements) {
            if(section.computedElementsMap.hasOwnProperty(element.key)) {
              section.computedElementsMap[element.key].push(element);
            } else {
              section.computedElementsMap[element.key] = [element];
            }
          }
        }
      }

      return section.computedElements;
    }
  }

  entries(fieldset) {
    if(fieldset.hasOwnProperty('mirror')) {
      return this.entries(fieldset.mirror);
    } else {
      if(!fieldset.hasOwnProperty('computedEntries')) {
        fieldset.computedEntriesMap = {};
        fieldset.computedEntries = fieldset.entries;

        for(const entry of fieldset.computedEntries) {
          if(fieldset.computedEntriesMap.hasOwnProperty(entry.key)) {
            fieldset.computedEntriesMap[entry.key].push(entry);
          } else {
            fieldset.computedEntriesMap[entry.key] = [entry];
          }
        }

        if(fieldset.hasOwnProperty('extend')) {
          const copiedEntries = this.entries(fieldset.extend).filter(entry =>
            !fieldset.computedEntriesMap.hasOwnProperty(entry.key)
          );

          fieldset.computedEntries = copiedEntries.concat(fieldset.computedEntries); // TODO: .push(...xy) somehow possible too? (but careful about order, which is relevant)

          for(const entry of copiedEntries) {
            if(fieldset.computedEntriesMap.hasOwnProperty(entry.key)) {
              fieldset.computedEntriesMap[entry.key].push(entry);
            } else {
              fieldset.computedEntriesMap[entry.key] = [entry];
            }
          }
        }
      }

      return fieldset.computedEntries;
    }
  }

  items(list) {
    if(list.hasOwnProperty('mirror')) {
      return this.items(list.mirror);
    } else if(!list.hasOwnProperty('extend')) {
      return list.items;
    } else {
      if(!list.hasOwnProperty('computedItems')) {
        list.computedItems = [...this.items(list.extend), ...list.items];
      }

      return list.computedItems;
    }
  }

  // TODO: raw() implies this would be the actual underlying structure used - maybe something like toNative or toJson is better (json would be good for interchangeable specs)
  raw(element) {
    const result = {
      type: PRETTY_TYPES[element.type]
    };

    if(element.hasOwnProperty('comments')) {
      result.comment = this.comment(element);
    }

    switch(element.type) {
      case FIELD_OR_FIELDSET_OR_LIST$3:  // fall through
      case EMPTY$1:
        result.key = element.key;
        break;
      case FIELD$4:
        result.key = element.key;
        result.value = this.value(element);
        break;
      case LIST_ITEM$4:
        result.value = this.value(element);
        break;
      case FIELDSET_ENTRY$4:
        result.key = element.key;
        result.value = this.value(element);
        break;
      case MULTILINE_FIELD_BEGIN$4:
        result.key = element.key;
        result.value = this.value(element);
        break;
      case LIST$4:
        result.key = element.key;
        result.items = this.items(element).map(item => this.raw(item));
        break;
      case FIELDSET$4:
        result.key = element.key;
        result.entries = this.entries(element).map(entry => this.raw(entry));
        break;
      case SECTION$6:
        result.key = element.key;
        // fall through
      case DOCUMENT$3:
        result.elements = this.elements(element).map(sectionElement => this.raw(sectionElement));
        break;
    }

    return result;
  }

  value(element) {
    if(!element.hasOwnProperty('computedValue')) {
      if(element.hasOwnProperty('mirror'))
        return this.value(element.mirror);

      element.computedValue = null;

      if(element.type === MULTILINE_FIELD_BEGIN$4) {
        if(element.lines.length > 0) {
          element.computedValue = this._input.substring(
            element.lines[0].ranges.line[0],
            element.lines[element.lines.length - 1].ranges.line[1]
          );
        }
      } else {
        if(element.hasOwnProperty('value')) {
          element.computedValue = element.value;  // TODO: *Could* consider not actually storing those, but lazily aquiring from substring as well (probably only makes sense in e.g. rust implementation though)
        }

        if(element.hasOwnProperty('continuations')) {
          let unappliedSpacing = false;

          for(let continuation of element.continuations) {
            if(element.computedValue === null) {
              element.computedValue = continuation.value;
              unappliedSpacing = false;
            } else if(continuation.value === null) {
              unappliedSpacing = unappliedSpacing || continuation.spaced;
            } else if(continuation.spaced || unappliedSpacing) {
              element.computedValue += ' ' + continuation.value;
              unappliedSpacing = false;
            } else {
              element.computedValue += continuation.value;
            }
          }
        }
      }
    }

    return element.computedValue;
  }
}

Context.prototype._analyze = analyze$1;
Context.prototype._resolve = resolve$1;

var Context_1 = Context;

var context = {
	Context: Context_1
};

class MissingElementBase {
  constructor(key, parent) {
    this._key = key;
    this._parent = parent;
  }

  _missingError(_element) {
    this._parent._missingError(this);
  }

  key(_loader) {
    this._parent._missingError(this);
  }

  optionalComment(_loader) {
    return null;
  }

  optionalStringComment() {
    return null;
  }

  // TODO: I think this I wanted to remove here and elsewhere and re-implement as internal helper for specs?
  raw() {
    return null;
  }

  requiredComment(_loader) {
    this._parent._missingError(this);
  }

  requiredStringComment() {
    this._parent._missingError(this);
  }

  stringKey() {
    this._parent._missingError(this);
  }
}

var MissingElementBase_1 = MissingElementBase;

var missing_element_base = {
	MissingElementBase: MissingElementBase_1
};

const { MissingElementBase: MissingElementBase$1 } = missing_element_base;

class MissingEmpty extends MissingElementBase$1 {
  get [Symbol.toStringTag]() {
    return 'MissingEmpty';
  }

  toString() {
    if(this._key === null)
      return `[object MissingEmpty]`;

    return `[object MissingEmpty key=${this._key}]`;
  }
}

var MissingEmpty_1 = MissingEmpty;

var missing_empty = {
	MissingEmpty: MissingEmpty_1
};

const { MissingElementBase: MissingElementBase$2 } = missing_element_base;

class MissingValueElementBase extends MissingElementBase$2 {
  optionalStringValue() {
    return null;
  }

  optionalValue(_loader) {
    return null;
  }

  requiredStringValue() {
    this._parent._missingError(this);
  }

  requiredValue() {
    this._parent._missingError(this);
  }
}

var MissingValueElementBase_1 = MissingValueElementBase;

var missing_value_element_base = {
	MissingValueElementBase: MissingValueElementBase_1
};

const { MissingValueElementBase: MissingValueElementBase$1 } = missing_value_element_base;

class MissingField extends MissingValueElementBase$1 {
  get [Symbol.toStringTag]() {
    return 'MissingField';
  }

  toString() {
    if(this._key === null)
      return `[object MissingField]`;

    return `[object MissingField key=${this._key}]`;
  }
}

var MissingField_1 = MissingField;

var missing_field = {
	MissingField: MissingField_1
};

const { MissingValueElementBase: MissingValueElementBase$2 } = missing_value_element_base;

class MissingFieldsetEntry extends MissingValueElementBase$2 {
  get [Symbol.toStringTag]() {
    return 'MissingFieldsetEntry';
  }

  toString() {
    if(this._key === null)
      return `[object MissingFieldsetEntry]`;

    return `[object MissingFieldsetEntry key=${this._key}]`;
  }
}

var MissingFieldsetEntry_1 = MissingFieldsetEntry;

var missing_fieldset_entry = {
	MissingFieldsetEntry: MissingFieldsetEntry_1
};

const { MissingElementBase: MissingElementBase$3 } = missing_element_base;

class MissingFieldset extends MissingElementBase$3 {
  get [Symbol.toStringTag]() {
    return 'MissingFieldset';
  }

  entries(_key = null) {
    return [];
  }

  entry(key = null) {
    return new missing_fieldset_entry.MissingFieldsetEntry(key, this);
  }

  optionalEntry(_key = null) {
    return null;
  }

  requiredEntry(_key = null) {
    this._parent._missingError(this);
  }

  toString() {
    if(this._key === null)
      return `[object MissingFieldset]`;

    return `[object MissingFieldset key=${this._key}]`;
  }
}

var MissingFieldset_1 = MissingFieldset;

var missing_fieldset = {
	MissingFieldset: MissingFieldset_1
};

const { MissingElementBase: MissingElementBase$4 } = missing_element_base;

class MissingList extends MissingElementBase$4 {
  get [Symbol.toStringTag]() {
    return 'MissingList';
  }

  items() {
    return [];
  }

  optionalStringValues() {
    return [];
  }

  optionalValues(_loader) {
    return [];
  }

  requiredStringValues() {
    return [];
  }

  requiredValues(_loader) {
    return [];
  }

  toString() {
    if(this._key === null)
      return `[object MissingList]`;

    return `[object MissingList key=${this._key}]`;
  }
}

var MissingList_1 = MissingList;

var missing_list = {
	MissingList: MissingList_1
};

const { MissingElementBase: MissingElementBase$5 } = missing_element_base;

class MissingSection extends MissingElementBase$5 {
  get [Symbol.toStringTag]() {
    return 'MissingSection';
  }

  empty(key = null) {
    return new missing_empty.MissingEmpty(key, this);
  }

  element(key = null) {
    return new missing_section_element.MissingSectionElement(key, this);
  }

  elements(_key = null) {
    return [];
  }

  field(key = null) {
    return new missing_field.MissingField(key, this);
  }

  fields(_key = null) {
    return [];
  }

  fieldset(key = null) {
    return new missing_fieldset.MissingFieldset(key, this);
  }

  fieldsets(_key = null) {
    return [];
  }

  list(key = null) {
    return new missing_list.MissingList(key, this);
  }

  lists(_key = null) {
    return [];
  }

  optionalElement(_key = null) {
    return null;
  }

  optionalEmpty(_key = null) {
    return null;
  }

  optionalField(_key = null) {
    return null;
  }

  optionalFieldset(_key = null) {
    return null;
  }

  optionalList(_key = null) {
    return null;
  }

  optionalSection(_key = null) {
    return null;
  }

  requiredElement(_key = null) {
    this._parent._missingError(this);
  }

  requiredEmpty(_key = null) {
    this._parent._missingError(this);
  }

  requiredField(_key = null) {
    this._parent._missingError(this);
  }

  requiredFieldset(_key = null) {
    this._parent._missingError(this);
  }

  requiredList(_key = null) {
    this._parent._missingError(this);
  }

  requiredSection(_key = null) {
    this._parent._missingError(this);
  }

  section(key = null) {
    return new MissingSection(key, this);
  }

  sections(_key = null) {
    return [];
  }

  toString() {
    if(this._key === null)
      return `[object MissingSection]`;

    return `[object MissingSection key=${this._key}]`;
  }
}

var MissingSection_1 = MissingSection;

var missing_section = {
	MissingSection: MissingSection_1
};

const { MissingElementBase: MissingElementBase$6 } = missing_element_base;

class MissingSectionElement extends MissingElementBase$6 {
  get [Symbol.toStringTag]() {
    return 'MissingSectionElement';
  }

  toEmpty() {
    return new missing_empty.MissingEmpty(this._key, this._parent);
  }

  toField() {
    return new missing_field.MissingField(this._key, this._parent);
  }

  toFieldset() {
    return new missing_fieldset.MissingFieldset(this._key, this._parent);
  }

  toList() {
    return new missing_list.MissingList(this._key, this._parent);
  }

  toSection() {
    return new missing_section.MissingSection(this._key, this._parent);
  }

  toString() {
    if(this._key === null)
      return `[object MissingSectionElement]`;

    return `[object MissingSectionElement key=${this._key}]`;
  }

  yieldsEmpty() {
    return true; // TODO: Throw instead?!
  }

  yieldsField() {
    return true; // TODO: Throw instead?!
  }

  yieldsFieldset() {
    return true; // TODO: Throw instead?!
  }

  yieldsList() {
    return true; // TODO: Throw instead?!
  }

  yieldsSection() {
    return true; // TODO: Throw instead?!
  }
}

var MissingSectionElement_1 = MissingSectionElement;

var missing_section_element = {
	MissingSectionElement: MissingSectionElement_1
};

const { ValidationError: ValidationError$1 } = error_types;
const { cursor: cursor$2, DOCUMENT_BEGIN: DOCUMENT_BEGIN$1, selection: selection$1, selectComments: selectComments$1, selectElement: selectElement$1, selectKey: selectKey$1 } = selections;
const {
  BEGIN: BEGIN$2,
  END: END$3,
  DOCUMENT: DOCUMENT$4,
  FIELD: FIELD$5,
  FIELDSET_ENTRY: FIELDSET_ENTRY$5,
  FIELD_OR_FIELDSET_OR_LIST: FIELD_OR_FIELDSET_OR_LIST$4,
  LIST_ITEM: LIST_ITEM$5,
  MULTILINE_FIELD_BEGIN: MULTILINE_FIELD_BEGIN$5
} = constants;

// TODO: Here and prominently also elsewhere - consider replacing instruction.ranges.line with instruction[LINE_RANGE] (where LINE_RANGE = Symbol('descriptive'))

var errors$3 = {
  commentError: (context, message, element) => {
    return new ValidationError$1(
      context.messages.commentError(message),
      new context.reporter(context).reportComments(element).snippet(),
      selectComments$1(element)
    );
  },

  elementError: (context, message, element) => {
    return new ValidationError$1(
      message,
      new context.reporter(context).reportElement(element).snippet(),
      selectElement$1(element)
    );
  },

  keyError: (context, message, element) => {
    return new ValidationError$1(
      context.messages.keyError(message),
      new context.reporter(context).reportLine(element).snippet(),
      selectKey$1(element)
    );
  },

  missingComment: (context, element) => {
    return new ValidationError$1(
      context.messages.missingComment,
      new context.reporter(context).reportLine(element).snippet(), // TODO: Question-tag an empty line before an element with missing comment
      selection$1(element, 'line', BEGIN$2)
    );
  },

  missingElement: (context, key, parent, message) => {
    return new ValidationError$1(
      key === null ? context.messages[message] : context.messages[message + 'WithKey'](key),
      new context.reporter(context).reportMissingElement(parent).snippet(),
      parent.type === DOCUMENT$4 ? DOCUMENT_BEGIN$1 : selection$1(parent, 'line', END$3)
    );
  },

  // TODO: Revisit and polish the two core value errors again at some point (missingValue / valueError)
  //       (In terms of quality of results and architecture - DRY up probably)
  //       Share best implementation among other eno libraries
  missingValue: (context, element) => {
    let message;
    const selection = {};

    if(element.type === FIELD$5 || element.type === FIELD_OR_FIELDSET_OR_LIST$4 || element.type === MULTILINE_FIELD_BEGIN$5) {
      message = context.messages.missingFieldValue(element.key);

      if(element.ranges.hasOwnProperty('template')) {
        selection.from = cursor$2(element, 'template', END$3);
      } else if(element.ranges.hasOwnProperty('elementOperator')) {
        selection.from = cursor$2(element, 'elementOperator', END$3);
      } else {
        selection.from = cursor$2(element, 'line', END$3);
      }
    } else if(element.type === FIELDSET_ENTRY$5) {
      message = context.messages.missingFieldsetEntryValue(element.key);
      selection.from = cursor$2(element, 'entryOperator', END$3);
    } else if(element.type === LIST_ITEM$5) {
      message = context.messages.missingListItemValue(element.parent.key);
      selection.from = cursor$2(element, 'itemOperator', END$3);
    }

    const snippet = new context.reporter(context).reportElement(element).snippet();

    if(element.type === FIELD$5 && element.continuations.length > 0) {
      selection.to = cursor$2(element.continuations[element.continuations.length - 1], 'line', END$3);
    } else {
      selection.to = cursor$2(element, 'line', END$3);
    }

    return new ValidationError$1(message, snippet, selection);
  },

  unexpectedElement: (context, message, element) => {
    return new ValidationError$1(
      message || context.messages.unexpectedElement,
      new context.reporter(context).reportElement(element).snippet(),
      selectElement$1(element)
    );
  },

  unexpectedMultipleElements: (context, key, elements, message) => {
    return new ValidationError$1(
      key === null ? context.messages[message] : context.messages[message + 'WithKey'](key),
      new context.reporter(context).reportElements(elements).snippet(),
      selectElement$1(elements[0])
    );
  },

  unexpectedElementType: (context, key, section, message) => {
    return new ValidationError$1(
      key === null ? context.messages[message] : context.messages[message + 'WithKey'](key),
      new context.reporter(context).reportElement(section).snippet(),
      selectElement$1(section)
    );
  },

  valueError: (context, message, element) => {
    let snippet, select;

    if(element.mirror) {
      snippet = new context.reporter(context).reportLine(element).snippet();
      select = selectKey$1(element);
    } else if(element.type === MULTILINE_FIELD_BEGIN$5) {
      if(element.lines.length > 0) {
        snippet = new context.reporter(context).reportMultilineValue(element).snippet();
        select = selection$1(element.lines[0], 'line', BEGIN$2, element.lines[element.lines.length - 1], 'line', END$3);
      } else {
        snippet = new context.reporter(context).reportElement(element).snippet();
        select = selection$1(element, 'line', END$3);
      }
    } else {
      snippet = new context.reporter(context).reportElement(element).snippet();
      select = {};

      if(element.ranges.hasOwnProperty('value')) {
        select.from = cursor$2(element, 'value', BEGIN$2);
      } else if(element.ranges.hasOwnProperty('elementOperator')) {
        select.from = cursor$2(element, 'elementOperator', END$3);
      } else if(element.ranges.hasOwnProperty('entryOperator')) {
        select.from = cursor$2(element, 'entryOperator', END$3);
      } else if(element.type === LIST_ITEM$5) {
        select.from = cursor$2(element, 'itemOperator', END$3);
      } else {
        // TODO: Possibly never reached - think through state permutations
        select.from = cursor$2(element, 'line', END$3);
      }

      if(element.continuations.length > 0) {
        select.to = cursor$2(element.continuations[element.continuations.length - 1], 'line', END$3);
      } else if(element.ranges.hasOwnProperty('value')) {
        select.to = cursor$2(element, 'value', END$3);
      } else {
        select.to = cursor$2(element, 'line', END$3);
      }
    }

    return new ValidationError$1(context.messages.valueError(message), snippet, select);
  }
};

var validation = {
	errors: errors$3
};

const { errors: errors$4 } = validation;
const { DOCUMENT: DOCUMENT$5, LIST_ITEM: LIST_ITEM$6 } = constants;

class ElementBase {
  constructor(context, instruction, parent = null) {
    this._context = context;
    this._instruction = instruction;
    this._parent = parent;
  }

  _comment(loader, required) {
    this._touched = true;

    const comment = this._context.comment(this._instruction);

    if(comment === null) {
      if(required)
        throw errors$4.missingComment(this._context, this._instruction);

      return null;
    }

    if(loader === null)
      return comment;

    try {
      return loader(comment);
    } catch(message) {
      throw errors$4.commentError(this._context, message, this._instruction);
    }
  }

  _key() {
    switch(this._instruction.type) {
      case DOCUMENT$5: return null;
      case LIST_ITEM$6: return this._instruction.parent.key;
      default: return this._instruction.key;
    }
  }

  /**
   * Constructs and returns a {@link ValidationError} with the supplied message in the context of this element's comment.
   *
   * Note that this only *returns* an error, whether you want to just use its
   * metadata, pass it on or actually throw the error is up to you.
   *
   * @param {string|function(comment: string): string} message A message or a function that receives the element's comment and returns the message.
   * @return {ValidationError} The requested error.
   */
  commentError(message) {
    return errors$4.commentError(
      this._context,
      typeof message === 'function' ? message(this._context.comment(this._instruction)) : message,
      this._instruction
    );
  }

  /**
   * Constructs and returns a {@link ValidationError} with the supplied message in the context of this element.
   *
   * Note that this only *returns* an error, whether you want to just use its
   * metadata, pass it on or actually throw the error is up to you.
   *
   * @param {string|function(element: Element): string} message A message or a function that receives the element and returns the message.
   * @return {ValidationError} The requested error.
   */
  error(message) {
    return errors$4.elementError(
      this._context,
      typeof message === 'function' ? message(this) : message,  // TODO: *this* is problematic in this context - what is it?
      this._instruction
    );
  }

  /**
   * Passes the key of this {@link Element} through the provided loader, returns the result and touches the element.
   * Throws a {@link ValidationError} if an error is intercepted from the loader.
   *
   * @example
   * // Given a field with the key 'foo' ...
   *
   * field.key(key => key.toUpperCase()); // returns 'FOO'
   * field.key(key => { throw 'You shall not pass!'; }); // throws an error based on the intercepted error message
   *
   * @param {function(key: string): any} loader A loader function taking the key as a `string` and returning any other type or throwing a `string` message.
   * @return {any} The result of applying the provided loader to this {@link Element}'s key.
   * @throws {ValidationError} Thrown when an error from the loader is intercepted.
   */
  key(loader) {
    this._touched = true;

    try {
      return loader(this._key());
    } catch(message) {
      throw errors$4.keyError(this._context, message, this._instruction);
    }
  }

  /**
   * Constructs and returns a {@link ValidationError} with the supplied message in the context of this element's key.
   *
   * Note that this only *returns* an error, whether you want to just use its
   * metadata, pass it on or actually throw the error is up to you.
   *
   * @param {string|function(key: string): string} message A message or a function that receives the element's key and returns the message.
   * @return {ValidationError} The requested error.
   */
  keyError(message) {
    return errors$4.keyError(
      this._context,
      typeof message === 'function' ? message(this._key()) : message,
      this._instruction
    );
  }

  /**
   * Passes the associated comment of this {@link Element} through the provided loader, returns the result and touches the element.
   * The loader is only invoked if there is an associated comment, otherwise `null` is returned directly.
   * Throws a {@link ValidationError} if an error is intercepted from the loader.
   *
   * @example
   * // Given a field with an associated comment 'foo' ...
   *
   * field.optionalComment(comment => comment.toUpperCase()); // returns 'FOO'
   * field.optionalComment(comment => { throw 'You shall not pass!'; }); // throws an error based on the intercepted error message
   *
   * // Given a field with no associated comment ...
   *
   * field.optionalComment(comment => comment.toUpperCase()); // returns null
   * field.optionalComment(comment => { throw 'You shall not pass!'; }); // returns null
   *
   * @param {function(value: string): any} loader A loader function taking the comment as `string` and returning any other type or throwing a `string` message.
   * @return {?any} The result of applying the provided loader to this {@link Element}'s comment, or `null` when none exists.
   * @throws {ValidationError} Thrown when an error from the loader is intercepted.
   */
  optionalComment(loader) {
    return this._comment(loader, false);
  }

  /**
   * Returns the associated comment of this {@link Element} as a `string` and touches the element.
   * Returns `null` if there is no associated comment.
   *
   * @return {?string} The associated comment of this {@link Element} as a `string`, or `null`.
   */
  optionalStringComment() {
    return this._comment(null, false);
  }

  /**
   * TODO: Adapt this documentation for the new generic one fits all implementation on Element
   *
   * For fields and fieldset entries returns an `object` of the form `{ key: 'value' }`, for list items returns the value as a `string` or null when empty.
   *
   * @return {object|string|null} The value of this {@link Field} as a `string` or the whole element represented as an `object`.
   */
  raw() {
    return this._context.raw(this._instruction);
  }

  /**
   * Passes the associated comment of this {@link Element} through the provided loader, returns the result and touches the element.
   * The loader is only invoked if there is an associated comment, otherwise a {@link ValidationError} is thrown directly.
   * Also throws a {@link ValidationError} if an error is intercepted from the loader.
   *
   * @example
   * // Given a field with an associated comment 'foo' ...
   *
   * field.requiredComment(comment => comment.toUpperCase()); // returns 'FOO'
   * field.requiredComment(comment => { throw 'You shall not pass!'; }); // throws an error based on the intercepted error message
   *
   * // Given a field with no associated comment ...
   *
   * field.requiredComment(comment => comment.toUpperCase()); // throws an error stating that a required comment is missing
   * field.requiredComment(comment => { throw 'You shall not pass!'; }); // throws an error stating that a required comment is missing
   *
   * @param {function(value: string): any} loader A loader function taking the comment as `string` and returning any other type or throwing a `string` message.
   * @return {any} The result of applying the provided loader to this {@link Element}'s comment.
   * @throws {ValidationError} Thrown when there is no associated comment or an error from the loader is intercepted.
   */
  requiredComment(loader) {
    return this._comment(loader, true);
  }

  /**
   * Returns the associated comment of this {@link Element} as a `string` and touches the element.
   * Throws a {@link ValidationError} if there is no associated comment.
   *
   * @return {string} The associated comment of this {@link Element} as a `string`.
   * @throws {ValidationError} Thrown when there is no associated comment.
   */
  requiredStringComment() {
    return this._comment(null, true);
  }

  /**
   * Returns the key of this {@link Element} as a `string` and touches the element.
   *
   * @return {string} The key of this {@link Element} as a `string`.
   */
  stringKey() {
    this._touched = true;

    return this._key();
  }

  /**
   * Touches this {@link Element} and all elements below it.
   */
  touch() {
    this._touched = true;
  }
}

var ElementBase_1 = ElementBase;

var element_base = {
	ElementBase: ElementBase_1
};

const { ElementBase: ElementBase$1 } = element_base;


class Empty extends ElementBase$1 {
  get [Symbol.toStringTag]() {
    return 'Empty';
  }

  parent() {
    return this._parent || new section.Section(this._context, this._instruction.parent);
  }

  /**
   * Returns a debug representation of this {@link Empty} in the form of `[object Empty key=foo]`.
   *
   * @return {string} A debug representation of this {@link Empty}.
   */
  toString() {
    return `[object Empty key=${this._instruction.key}]`;
  }
}

var Empty_1 = Empty;

var empty = {
	Empty: Empty_1
};

const { ElementBase: ElementBase$2 } = element_base;
const { errors: errors$5 } = validation;

class ValueElementBase extends ElementBase$2 {
  _printValue() {
    let value = this._context.value(this._instruction);

    // TODO: Actually we are missing a differentiation between 'null' and null here,
    //       improve at some point (across all implementations)
    if(value === null) return 'null';

    if(value.length > 14) {
      value = value.substring(0, 11) + '...';
    }

    return value.replace('\n', '\\n');
  }

  _value(loader, required) {
    this._touched = true;

    const value = this._context.value(this._instruction);

    if(value === null) {
      if(required)
        throw errors$5.missingValue(this._context, this._instruction);

      return null;
    }

    if(!loader)
      return value;

    try {
      return loader(value);
    } catch(message) {
      // TODO: Consider a re-specification of what is thrown/caught in regards to loaders,
      //       basically "throw 'plain string';" vs. "throw new Error('wrapped');"
      //       The latter makes much more sense from a standards perspective and probably
      //       should be specified as a new default, but supporting both still would make
      //       sense for the sake of convenience and robustness.

      throw errors$5.valueError(this._context, message, this._instruction);
    }
  }

  optionalStringValue() {
    return this._value(null, false);
  }

  optionalValue(loader) {
    return this._value(loader, false);
  }

  requiredStringValue() {
    return this._value(null, true);
  }

  requiredValue(loader) {
    return this._value(loader, true);
  }

  /**
   * Constructs and returns a {@link ValidationError} with the supplied message in the context of this element's value.
   *
   * Note that this only *returns* an error, whether you want to just use its
   * metadata, pass it on or actually throw the error is up to you.
   *
   * @param {string|function(value: string): string} message A message or a function that receives the element's value and returns the message.
   * @return {ValidationError} The requested error.
   */
  valueError(message) {
    return errors$5.valueError(
      this._context,
      typeof message === 'function' ? message(this._context.value(this._instruction)) : message,
      this._instruction
    );
  }
}

var ValueElementBase_1 = ValueElementBase;

var value_element_base = {
	ValueElementBase: ValueElementBase_1
};

const { errors: errors$6 } = validation;
const { ValueElementBase: ValueElementBase$1 } = value_element_base;

class Field extends ValueElementBase$1 {
  get [Symbol.toStringTag]() {
    return 'Field';
  }

  _value(loader, required) {
    this._touched = true;

    const value = this._context.value(this._instruction);

    if(value === null) {
      if(required)
        throw errors$6.missingValue(this._context, this._instruction);

      return null;
    }

    if(!loader)
      return value;

    try {
      return loader(value);
    } catch(message) {
      throw errors$6.valueError(this._context, message, this._instruction);
    }
  }

  /**
   * Returns the value of this {@link Field} as a `string` and touches the element.
   * Returns `null` if there is no value.
   *
   * @return {?string} The value of this {@link Field} as a `string`, or `null`.
   */
  optionalStringValue() {
    return this._value(null, false);
  }

  /**
   * Passes the value of this {@link Field} through the provided loader, returns the result and touches the element.
   * The loader is only invoked if there is a value, otherwise `null` is returned directly.
   * Throws a {@link ValidationError} if an error is intercepted from the loader.
   *
   * @example
   * // Given a field containing the value 'foo' ...
   *
   * field.optionalValue(value => value.toUpperCase()); // returns 'FOO'
   * field.optionalValue(value => { throw 'You shall not pass!'; }); // throws an error based on the intercepted error message
   *
   * // Given a field containing no value ...
   *
   * field.optionalValue(value => value.toUpperCase()); // returns null
   * field.optionalValue(value => { throw 'You shall not pass!'; }); // returns null
   *
   * @param {function(value: string): any} loader A loader function taking a `string` value and returning any other type or throwing a `string` message.
   * @return {?any} The result of applying the provided loader to this {@link Field}'s value, or `null` when empty.
   * @throws {ValidationError} Thrown when an error from the loader is intercepted.
   */
  optionalValue(loader) {
    return this._value(loader, false);
  }

  /**
   * Returns the parent instance, either a {@link Fieldset}, {@link List} or {@link Section}.
   *
   * @return {Fieldset|List|Section} The parent element instance.
   */
  parent() {
    return this._parent || new section.Section(this._context, this._instruction.parent);
  }

  /**
   * Returns the value of this {@link Field} as a `string` and touches the element.
   * Throws a {@link ValidationError} if there is no value.
   *
   * @return {string} The value of this {@link Field} as a `string`.
   * @throws {ValidationError} Thrown when there is no value.
   */
  requiredStringValue() {
    return this._value(null, true);
  }

  /**
   * Passes the value of this {@link Field} through the provided loader, returns the result and touches the element.
   * The loader is only invoked if there is a value, otherwise a {@link ValidationError} is thrown directly.
   * Also throws a {@link ValidationError} if an error is intercepted from the loader.
   *
   * @example
   * // Given a field containing the value 'foo' ...
   *
   * field.requiredValue(value => value.toUpperCase()); // returns 'FOO'
   * field.requiredValue(value => { throw 'You shall not pass!'; }); // throws an error based on the intercepted error message
   *
   * // Given a field containing no value ...
   *
   * field.requiredValue(value => value.toUpperCase()); // throws an error stating that a required value is missing
   * field.requiredValue(value => { throw 'You shall not pass!'; }); // throws an error stating that a required value is missing
   *
   * @param {function(value: string): any} loader A loader function taking a `string` value and returning any other type or throwing a `string` message.
   * @return {any} The result of applying the provided loader to this {@link Field}'s value.
   * @throws {ValidationError} Thrown when there is no value or an error from the loader is intercepted.
   */
  requiredValue(loader) {
    return this._value(loader, true);
  }

  /**
   * Returns a debug representation of this {@link Field} in the form of `[object Field key=foo value=bar]`.
   *
   * @return {string} A debug representation of this {@link Field}.
   */
  toString() {
    return `[object Field key=${this._instruction.key} value=${this._printValue()}]`;
  }
}

var Field_1 = Field;

var field = {
	Field: Field_1
};

const { ValueElementBase: ValueElementBase$2 } = value_element_base;

class ListItem extends ValueElementBase$2 {
  get [Symbol.toStringTag]() {
    return 'ListItem';
  }

  parent() {
    return this._parent || new list.List(this._context, this._instruction.parent);
  }

  toString() {
    return `[object ListItem value=${this._printValue()}]`;
  }
}

var ListItem_1 = ListItem;

var list_item = {
	ListItem: ListItem_1
};

const { ElementBase: ElementBase$3 } = element_base;

class List extends ElementBase$3 {
  get [Symbol.toStringTag]() {
    return 'List';
  }

  _instantiateItems(list) {
    if(list.hasOwnProperty('mirror')) {
      return this._instantiateItems(list.mirror);
    } else if(list.hasOwnProperty('extend')) {
      return [
        ...this._instantiateItems(list.extend),
        ...list.items.map(item => new list_item.ListItem(this._context, item, this))
      ];
    } else if(list.hasOwnProperty('items')) {
      return list.items.map(item => new list_item.ListItem(this._context, item, this));
    } else {
      return [];
    }
  }

  _items() {
    if(!this.hasOwnProperty('_instantiatedItems')) {
      this._instantiatedItems = this._instantiateItems(this._instruction);
    }

    return this._instantiatedItems;
  }

  _untouched() {
    if(!this._touched)
      return this._instruction;

    const untouchedItem = this._items().find(item => !item._touched);

    return untouchedItem ? untouchedItem._instruction : false;
  }

  /**
   * Returns the items in this {@link List} as an array.
   *
   * @return {Field[]} The items in this {@link List}.
   */
  items() {
    this._touched = true;

    return this._items();
  }

  /**
   * Returns the number of items in this {@link List} as a `number`.
   *
   * @return {number} The number of items in this {@link List}.
   */
  length() {
    this._touched = true;

    return this._items().length;
  }

  optionalStringValues() {
    this._touched = true;

    return this._items().map(item => item.optionalStringValue());
  }

  optionalValues(loader) {
    this._touched = true;

    return this._items().map(item => item.optionalValue(loader));
  }

  /**
   * Returns the parent {@link Section}.
   *
   * @return {Section} The parent section.
   */
  parent() {
    return this._parent || new section.Section(this._context, this._instruction.parent);
  }

  requiredStringValues() {
    this._touched = true;

    return this._items().map(item => item.requiredStringValue());
  }

  requiredValues(loader) {
    this._touched = true;

    return this._items().map(item => item.requiredValue(loader));
  }

  /**
   * Returns a debug representation of this {@link List} in the form of `[object List key=foo items=2]`.
   *
   * @return {string} A debug representation of this {@link List}.
   */
  toString() {
    return `[object List key=${this._instruction.key} items=${this._items().length}]`;
  }

  touch() {
    this._touched = true;

    for(const item of this.items()) {
      item._touched = true;
    }
  }
}

var List_1 = List;

var list = {
	List: List_1
};

const { ElementBase: ElementBase$4 } = element_base;
const { errors: errors$7 } = validation;

const {
  EMPTY: EMPTY$2,
  FIELD: FIELD$6,
  FIELDSET: FIELDSET$5,
  FIELD_OR_FIELDSET_OR_LIST: FIELD_OR_FIELDSET_OR_LIST$5,
  LIST: LIST$5,
  MULTILINE_FIELD_BEGIN: MULTILINE_FIELD_BEGIN$6,
  PRETTY_TYPES: PRETTY_TYPES$1,
  SECTION: SECTION$7
} = constants;

// TODO: If this SectionElement gets touched (this._touched = true;),
//       the touched flag needs to be propagated down the hierarchy
//       when toSomething() is called to typecast the SectionElement.
//       I.e. the constructors for Field/Fieldset/etc. need to accept
//       this extra init parameter probably and it has to be passed
//       on lazily all the way down to the terminal leaves of the tree.
//       (applies to all implementations)

class SectionElement extends ElementBase$4 {
  _untouched() {
    if(!this.hasOwnProperty('_yielded') && !this.hasOwnProperty('_touched'))
      return this._instruction;
    if(this.hasOwnProperty('_empty') && !this._empty.hasOwnProperty('_touched'))
      return this._instruction;
    if(this.hasOwnProperty('_field') && !this._field.hasOwnProperty('_touched'))
      return this._instruction;
    if(this.hasOwnProperty('_fieldset'))
      return this._fieldset._untouched();
    if(this.hasOwnProperty('_list'))
      return this._list._untouched();
    if(this.hasOwnProperty('_section'))
      return this._section._untouched();
  }

  _yields() {
    if(this._instruction.type === FIELD_OR_FIELDSET_OR_LIST$5)
      return `${PRETTY_TYPES$1[FIELD$6]},${PRETTY_TYPES$1[FIELDSET$5]},${PRETTY_TYPES$1[LIST$5]}`;

    return PRETTY_TYPES$1[this._instruction.type];
  }

  toEmpty() {
    if(!this.hasOwnProperty('_empty')) {
      if(this._instruction.type !== EMPTY$2)
        throw errors$7.unexpectedElementType(this._context, null, this._instruction, 'expectedEmpty');

      this._empty = new empty.Empty(this._context, this._instruction, this._parent);
      this._yielded = EMPTY$2;
    }

    return this._empty;
  }

  toField() {
    if(!this.hasOwnProperty('_field')) {
      if(this.hasOwnProperty('_yielded'))
        throw new Error(`This element was already yielded as ${PRETTY_TYPES$1[this._yielded]} and can't be yielded again as a field.`);

      if(this._instruction.type != FIELD$6 &&
         this._instruction.type !== MULTILINE_FIELD_BEGIN$6 &&
         this._instruction.type !== FIELD_OR_FIELDSET_OR_LIST$5)
        throw errors$7.unexpectedElementType(this._context, null, this._instruction, 'expectedField');

      this._field = new field.Field(this._context, this._instruction, this._parent);
      this._yielded = FIELD$6;
    }

    return this._field;
  }

  toFieldset() {
    if(!this.hasOwnProperty('_fieldset')) {
      if(this.hasOwnProperty('_yielded'))
        throw new Error(`This element was already yielded as ${PRETTY_TYPES$1[this._yielded]} and can't be yielded again as a fieldset.`);

      if(this._instruction.type !== FIELDSET$5 && this._instruction.type !== FIELD_OR_FIELDSET_OR_LIST$5)
        throw errors$7.unexpectedElementType(this._context, null, this._instruction, 'expectedFieldset');

      this._fieldset = new fieldset.Fieldset(this._context, this._instruction, this._parent);
      this._yielded = FIELDSET$5;
    }

    return this._fieldset;
  }

  toList() {
    if(!this.hasOwnProperty('_list')) {
      if(this.hasOwnProperty('_yielded'))
        throw new Error(`This element was already yielded as ${PRETTY_TYPES$1[this._yielded]} and can't be yielded again as a list.`);

      if(this._instruction.type !== LIST$5 && this._instruction.type !== FIELD_OR_FIELDSET_OR_LIST$5)
        throw errors$7.unexpectedElementType(this._context, null, this._instruction, 'expectedList');

      this._list = new list.List(this._context, this._instruction, this._parent);
      this._yielded = LIST$5;
    }

    return this._list;
  }

  toSection() {
    if(!this.hasOwnProperty('_section')) {
      if(this._instruction.type !== SECTION$7)
        throw errors$7.unexpectedElementType(this._context, null, this._instruction, 'expectedSection');

      this._section = new section.Section(this._context, this._instruction, this._parent);
      this._yielded = SECTION$7;
    }

    return this._section;
  }

  /**
   * Returns a debug representation of this {@link SectionElement} in the form of `[object SectionElement key=foo yields=field]`.
   *
   * @return {string} A debug representation of this {@link SectionElement}.
   */
  toString() {
    return `[object SectionElement key=${this._key()} yields=${this._yields()}]`;
  }

  touch() {
    if(!this.hasOwnProperty('_yielded')) {
      this._touched = true;
    } else if(this.hasOwnProperty('_empty')) {
      this._empty._touched = true;
    } else if(this.hasOwnProperty('_field')) {
      this._field._touched = true;
    } else if(this.hasOwnProperty('_fieldset')) {
      this._fieldset.touch();
    } else if(this.hasOwnProperty('_list')) {
      this._list.touch();
    } else if(this.hasOwnProperty('_section')) {
      this._section.touch();
    }
  }

  yieldsEmpty() {
    return this._instruction.type === EMPTY$2;
  }

  yieldsField() {
    return this._instruction.type === FIELD$6 ||
           this._instruction.type === MULTILINE_FIELD_BEGIN$6 ||
           this._instruction.type === FIELD_OR_FIELDSET_OR_LIST$5;
  }

  yieldsFieldset() {
    return this._instruction.type === FIELDSET$5 ||
           this._instruction.type === FIELD_OR_FIELDSET_OR_LIST$5;
  }

  yieldsList() {
    return this._instruction.type === LIST$5 ||
           this._instruction.type === FIELD_OR_FIELDSET_OR_LIST$5;
  }

  yieldsSection() {
    return this._instruction.type === SECTION$7;
  }
}

var SectionElement_1 = SectionElement;

var section_element = {
	SectionElement: SectionElement_1
};

// TODO: touch() on ambiguous and/or missing elements
const { errors: errors$8 } = validation;
const { ElementBase: ElementBase$5 } = element_base;

const {
  DOCUMENT: DOCUMENT$6,
  EMPTY: EMPTY$3,
  FIELD: FIELD$7,
  FIELDSET: FIELDSET$6,
  FIELD_OR_FIELDSET_OR_LIST: FIELD_OR_FIELDSET_OR_LIST$6,
  LIST: LIST$6,
  MULTILINE_FIELD_BEGIN: MULTILINE_FIELD_BEGIN$7,
  SECTION: SECTION$8
} = constants;

// TODO: For each value store the representational type as well ? (e.g. string may come from "- foo" or -- foo\nxxx\n-- foo) and use that for precise error messages?

// TODO: These things ->   case MULTILINE_FIELD_BEGIN: /* handled in FIELD below */
//       Maybe handle with a generic FIELD type and an additional .multiline flag on the instruction? (less queries but quite some restructuring)

class Section extends ElementBase$5 {
  constructor(context, instruction, parent = null) {
    super(context, instruction, parent);

    this._allElementsRequired = parent ? parent._allElementsRequired : false;
  }

  get [Symbol.toStringTag]() {
    return 'Section';
  }

  _element(key, required = null) {
    this._touched = true;

    let elements;
    if(key === null) {
      elements = this._elements();
    } else {
      const elementsMap = this._elements(true);
      elements = elementsMap.hasOwnProperty(key) ? elementsMap[key] : [];
    }

    if(elements.length === 0) {
      if(required || required === null && this._allElementsRequired) {
        throw errors$8.missingElement(this._context, key, this._instruction, 'missingElement');
      } else if(required === null) {
        return new missing_section_element.MissingSectionElement(key, this);
      } else {
        return null;
      }
    }

    if(elements.length > 1)
      throw errors$8.unexpectedMultipleElements(
        this._context,
        key,
        elements.map(element => element._instruction),
        'expectedSingleElement'
      );

    return elements[0];
  }

  _elements(map = false) {
    if(!this.hasOwnProperty('_instantiatedElements')) {
      this._instantiatedElements = [];
      this._instantiatedElementsMap = {};
      this._instantiateElements(this._instruction);
    }

    return map ? this._instantiatedElementsMap : this._instantiatedElements;
  }

  _empty(key, required = null) {
    this._touched = true;

    let elements;
    if(key === null) {
      elements = this._elements();
    } else {
      const elementsMap = this._elements(true);
      elements = elementsMap.hasOwnProperty(key) ? elementsMap[key] : [];
    }

    if(elements.length === 0) {
      if(required || required === null && this._allElementsRequired) {
        throw errors$8.missingElement(this._context, key, this._instruction, 'missingEmpty');
      } else if(required === null) {
        return new missing_empty.MissingEmpty(key, this);
      } else {
        return null;
      }
    }

    if(elements.length > 1)
      throw errors$8.unexpectedMultipleElements(
        this._context,
        key,
        elements.map(element => element._instruction),
        'expectedSingleEmpty'
      );

    const element = elements[0];

    if(element._instruction.type !== EMPTY$3)
      throw errors$8.unexpectedElementType(this._context, key, element._instruction, 'expectedEmpty');

    return element.toEmpty();
  }

  _field(key, required = null) {
    this._touched = true;

    let elements;
    if(key === null) {
      elements = this._elements();
    } else {
      const elementsMap = this._elements(true);
      elements = elementsMap.hasOwnProperty(key) ? elementsMap[key] : [];
    }

    if(elements.length === 0) {
      if(required || required === null && this._allElementsRequired) {
        throw errors$8.missingElement(this._context, key, this._instruction, 'missingField');
      } else if(required === null) {
        return new missing_field.MissingField(key, this);
      } else {
        return null;
      }
    }

    if(elements.length > 1)
      throw errors$8.unexpectedMultipleElements(
        this._context,
        key,
        elements.map(element => element._instruction),
        'expectedSingleField'
      );

    const element = elements[0];

    // TODO: Here and elsewhere these multiple checks are repeated in toField/to* again,
    //       should be optimized e.g. by going through a private toField cast mechanism
    //       without redundant checks. (or reconsidering the whole concept of storing
    //       SectionElement instances by default in sections)
    if(element._instruction.type !== FIELD$7 &&
       element._instruction.type !== MULTILINE_FIELD_BEGIN$7 &&
       element._instruction.type !== FIELD_OR_FIELDSET_OR_LIST$6)
      throw errors$8.unexpectedElementType(this._context, key, element._instruction, 'expectedField');

    return element.toField();
  }

  _fieldset(key, required = null) {
    this._touched = true;

    let elements;
    if(key === null) {
      elements = this._elements();
    } else {
      const elementsMap = this._elements(true);
      elements = elementsMap.hasOwnProperty(key) ? elementsMap[key] : [];
    }

    if(elements.length === 0) {
      if(required || required === null && this._allElementsRequired) {
        throw errors$8.missingElement(this._context, key, this._instruction, 'missingFieldset');
      } else if(required === null) {
        return new missing_fieldset.MissingFieldset(key, this);
      } else {
        return null;
      }
    }

    if(elements.length > 1)
      throw errors$8.unexpectedMultipleElements(
        this._context,
        key,
        elements.map(element => element._instruction),
        'expectedSingleFieldset'
      );

    const element = elements[0];

    if(element._instruction.type !== FIELDSET$6 && element._instruction.type !== FIELD_OR_FIELDSET_OR_LIST$6)
      throw errors$8.unexpectedElementType(this._context, key, element._instruction, 'expectedFieldset');

    return element.toFieldset();
  }

  _instantiateElements(section) {
    if(section.hasOwnProperty('mirror')) {
      this._instantiateElements(section.mirror);
    } else {
      this._instantiatedElements.push(
        ...section.elements.filter(element =>
          !this._instantiatedElementsMap.hasOwnProperty(element.key)
        ).map(element => {
          const instance = new section_element.SectionElement(this._context, element, this);

          if(this._instantiatedElementsMap.hasOwnProperty(element.key)) {
            this._instantiatedElementsMap[element.key].push(instance);
          } else {
            this._instantiatedElementsMap[element.key] = [instance];
          }

          return instance;
        })
      );

      if(section.hasOwnProperty('extend')) {
        this._instantiateElements(section.extend);
      }
    }
  }

  _list(key, required = null) {
    this._touched = true;

    let elements;
    if(key === null) {
      elements = this._elements();
    } else {
      const elementsMap = this._elements(true);
      elements = elementsMap.hasOwnProperty(key) ? elementsMap[key] : [];
    }

    if(elements.length === 0) {
      if(required || required === null && this._allElementsRequired) {
        throw errors$8.missingElement(this._context, key, this._instruction, 'missingList');
      } else if(required === null) {
        return new missing_list.MissingList(key, this);
      } else {
        return null;
      }
    }

    if(elements.length > 1)
      throw errors$8.unexpectedMultipleElements(
        this._context,
        key,
        elements.map(element => element._instruction),
        'expectedSingleList'
      );

    const element = elements[0];

    if(element._instruction.type !== LIST$6 && element._instruction.type !== FIELD_OR_FIELDSET_OR_LIST$6)
      throw errors$8.unexpectedElementType(this._context, key, element._instruction, 'expectedList');

    return element.toList();
  }

  // TODO: Can probably be simplified again - e.g. pushed back into Missing* classes themselves - also check if MissingFieldsetEntry addition is made use of already
  _missingError(element) {
    if(element instanceof missing_field.MissingField) {
      throw errors$8.missingElement(this._context, element._key, this._instruction, 'missingField');
    } else if(element instanceof missing_fieldset.MissingFieldset) {
      throw errors$8.missingElement(this._context, element._key, this._instruction, 'missingFieldset');
    } else if(element instanceof missing_list.MissingList) {
      throw errors$8.missingElement(this._context, element._key, this._instruction, 'missingList');
    } else if(element instanceof missing_section.MissingSection) {
      throw errors$8.missingElement(this._context, element._key, this._instruction, 'missingSection');
    } else {
      throw errors$8.missingElement(this._context, element._key, this._instruction, 'missingElement');
    }
  }

  _section(key, required = null) {
    this._touched = true;

    let elements;
    if(key === null) {
      elements = this._elements();
    } else {
      const elementsMap = this._elements(true);
      elements = elementsMap.hasOwnProperty(key) ? elementsMap[key] : [];
    }

    if(elements.length === 0) {
      if(required || required === null && this._allElementsRequired) {
        throw errors$8.missingElement(this._context, key, this._instruction, 'missingSection');
      } else if(required === null) {
        return new missing_section.MissingSection(key, this);
      } else {
        return null;
      }
    }

    if(elements.length > 1)
      throw errors$8.unexpectedMultipleElements(
        this._context,
        key,
        elements.map(element => element._instruction),
        'expectedSingleSection'
      );

    const element = elements[0];

    if(element._instruction.type !== SECTION$8)
      throw errors$8.unexpectedElementType(this._context, key, element._instruction, 'expectedSection');

    return element.toSection();
  }

  _untouched() {
    if(!this._touched)
      return this._instruction;

    for(const element of this._elements()) {
      const untouchedElement = element._untouched();

      if(untouchedElement) return untouchedElement;
    }

    return false;
  }

  allElementsRequired(required = true) {
    this._allElementsRequired = required;

    for(const element of this._elements()) {
      if(element._instruction.type === SECTION$8 && element._yielded) {
        element.toSection().allElementsRequired(required);
      } else if(element._instruction.type === FIELDSET$6 && element._yielded) {
        element.toFieldset().allEntriesRequired(required);
      }
    }
  }

  // TODO: Revisit this method name (ensureAllTouched? ... etc.)
  /**
   * Assert that all elements inside this section/document have been touched
   * @param {string} message A static string error message or a message function taking the excess element and returning an error string
   * @param {object} options
   * @param {array} options.except An array of element keys to exclude from assertion
   * @param {array} options.only Specifies to ignore all elements but the ones includes in this array of element keys
   */
  assertAllTouched(...optional) {
    let message = null;
    let options = {};

    for(const argument of optional) {
      if(typeof argument === 'object') {
        options = argument;
      } else {
        message = argument;
      }
    }

    const elementsMap = this._elements(true);

    for(const [key, elements] of Object.entries(elementsMap)) {
      if(options.hasOwnProperty('except') && options.except.includes(key)) continue;
      if(options.hasOwnProperty('only') && !options.only.includes(key)) continue;

      for(const element$1 of elements) {
        const untouched = element$1._untouched();

        if(untouched) {
          if(typeof message === 'function') {
            // TODO: This doesn't make use of a possible cached Element, although, SectionElement would be unusable here anyway ...
            message = message(new element.Element(this._context, untouched, this));
          }

          throw errors$8.unexpectedElement(this._context, message, untouched);
        }
      }
    }
  }

  element(key = null) {
    return this._element(key);
  }

  /**
   * Returns the elements of this {@link Section} as an array in the original document order.
   *
   * @param {string} [key] If provided only elements with the specified key are returned.
   * @return {Element[]} The elements of this {@link Section}.
   */
  elements(key = null) {
    this._touched = true;

    if(key === null) {
      return this._elements();
    } else {
      const elementsMap = this._elements(true);
      return elementsMap.hasOwnProperty(key) ? elementsMap[key] : [];
    }
  }

  empty(key = null) {
    return this._empty(key);
  }

  // TODO: Here and in other implementations and in missing_section: empties(...) ?

  field(key = null) {
    return this._field(key);
  }

  fields(key = null) {
    this._touched = true;

    let elements;
    if(key === null) {
      elements = this._elements();
    } else {
      const elementsMap = this._elements(true);
      elements = elementsMap.hasOwnProperty(key) ? elementsMap[key] : [];
    }

    return elements.map(element => {
      if(element._instruction.type !== FIELD$7 &&
         element._instruction.type !== MULTILINE_FIELD_BEGIN$7 &&
         element._instruction.type !== FIELD_OR_FIELDSET_OR_LIST$6)
        throw errors$8.unexpectedElementType(this._context, key, element._instruction, 'expectedFields');

      return element.toField();
    });
  }

  fieldset(key = null) {
    return this._fieldset(key);
  }

  fieldsets(key = null) {
    this._touched = true;

    let elements;
    if(key === null) {
      elements = this._elements();
    } else {
      const elementsMap = this._elements(true);
      elements = elementsMap.hasOwnProperty(key) ? elementsMap[key] : [];
    }

    return elements.map(element => {
      if(element._instruction.type !== FIELDSET$6 && element._instruction.type !== FIELD_OR_FIELDSET_OR_LIST$6)
        throw errors$8.unexpectedElementType(this._context, key, element._instruction, 'expectedFieldsets');

      return element.toFieldset();
    });
  }

  list(key = null) {
    return this._list(key);
  }

  lists(key = null) {
    this._touched = true;

    let elements;
    if(key === null) {
      elements = this._elements();
    } else {
      const elementsMap = this._elements(true);
      elements = elementsMap.hasOwnProperty(key) ? elementsMap[key] : [];
    }

    return elements.map(element => {
      if(element._instruction.type !== LIST$6 && element._instruction.type !== FIELD_OR_FIELDSET_OR_LIST$6)
        throw errors$8.unexpectedElementType(this._context, key, element._instruction, 'expectedLists');

      return element.toList();
    });
  }

  optionalElement(key = null) {
    return this._element(key, false);
  }

  optionalEmpty(key = null) {
    return this._empty(key, false);
  }

  optionalField(key = null) {
    return this._field(key, false);
  }

  optionalFieldset(key = null) {
    return this._fieldset(key, false);
  }

  optionalList(key = null) {
    return this._list(key, false);
  }

  optionalSection(key = null) {
    return this._section(key, false);
  }

  /**
   * Returns the parent {@link Section} or null when called on the document.
   *
   * @return {?Section} The parent instance or null.
   */
  parent() {
    if(this._instruction.type === DOCUMENT$6)
      return null;

    return this._parent || new Section(this._context, this._instruction.parent);
  }

  requiredElement(key = null) {
    return this._element(key, true);
  }

  requiredEmpty(key = null) {
    return this._empty(key, true);
  }

  requiredField(key = null) {
    return this._field(key, true);
  }

  requiredFieldset(key = null) {
    return this._fieldset(key, true);
  }

  requiredList(key = null) {
    return this._list(key, true);
  }

  requiredSection(key = null) {
    return this._section(key, true);
  }

  section(key = null) {
    return this._section(key);
  }

  sections(key = null) {
    this._touched = true;

    let elements;
    if(key === null) {
      elements = this._elements();
    } else {
      const elementsMap = this._elements(true);
      elements = elementsMap.hasOwnProperty(key) ? elementsMap[key] : [];
    }

    return elements.map(element => {
      if(element._instruction.type !== SECTION$8)
        throw errors$8.unexpectedElementType(this._context, key, element._instruction, 'expectedSections');

      return element.toSection();
    });
  }

  /**
   * Returns a debug representation of this {@link Section} in the form of `[object Section key=foo elements=2]`, respectively `[object Section document elements=2]` for the document itself.
   *
   * @return {string} A debug representation of this {@link Section}.
   */
  toString() {
    if(this._instruction.type === DOCUMENT$6)
      return `[object Section document elements=${this._elements().length}]`;

    return `[object Section key=${this._instruction.key} elements=${this._elements().length}]`;
  }

  touch() {
    // TODO: Potentially revisit this - maybe we can do a shallow touch, that is: propagating only to the hierarchy below that was already instantiated,
    //       while marking the deepest initialized element as _touchedRecursive/Deeply or something, which marks a border for _untouched() checks that
    //       does not have to be traversed deeper down. However if after that the hierarchy is used after all, the _touched property should be picked
    //       up starting at the element marked _touchedRecursive, passing the property down below.

    this._touched = true;

    for(const element of this._elements()) {
      element.touch();
    }
  }
}

var Section_1 = Section;

var section = {
	Section: Section_1
};

const { ElementBase: ElementBase$6 } = element_base;
const { errors: errors$9 } = validation;

class Fieldset extends ElementBase$6 {
  constructor(context, instruction, parent = null) {
    super(context, instruction, parent);

    this._allEntriesRequired = parent ? parent._allElementsRequired : false;
  }

  get [Symbol.toStringTag]() {
    return 'Fieldset';
  }

  _entries(map = false) {
    if(!this.hasOwnProperty('_instantiatedEntries')) {
      this._instantiatedEntries = [];
      this._instantiatedEntriesMap = {};
      this._instantiateEntries(this._instruction);
    }

    return map ? this._instantiatedEntriesMap : this._instantiatedEntries;
  }

  _entry(key, required = null) {
    this._touched = true;

    let entries;
    if(key === null) {
      entries = this._entries();
    } else {
      const entriesMap = this._entries(true);
      entries = entriesMap.hasOwnProperty(key) ? entriesMap[key] : [];
    }

    if(entries.length === 0) {
      if(required || required === null && this._allEntriesRequired) {
        throw errors$9.missingElement(this._context, key, this._instruction, 'missingFieldsetEntry');
      } else if(required === null) {
        return new missing_fieldset_entry.MissingFieldsetEntry(key, this);
      } else {
        return null;
      }
    }

    if(entries.length > 1)
      throw errors$9.unexpectedMultipleElements(
        this._context,
        key,
        entries.map(entry => entry._instruction),
        'expectedSingleFieldsetEntry'
      );

    return entries[0];
  }

  _instantiateEntries(fieldset) {
    if(fieldset.hasOwnProperty('mirror')) {
      this._instantiateEntries(fieldset.mirror);
    } else if(fieldset.hasOwnProperty('entries')) {
      const nativeEntries = fieldset.entries.filter(entry =>
        !this._instantiatedEntriesMap.hasOwnProperty(entry.key)
      ).map(entry => {
        const instance = new fieldset_entry.FieldsetEntry(this._context, entry, this);

        if(this._instantiatedEntriesMap.hasOwnProperty(entry.key)) {
          this._instantiatedEntriesMap[entry.key].push(instance);
        } else {
          this._instantiatedEntriesMap[entry.key] = [instance];
        }

        return instance;
      });

      if(fieldset.hasOwnProperty('extend')) {
        this._instantiateEntries(fieldset.extend);
      }

      this._instantiatedEntries.push(...nativeEntries);
    }
  }

  _missingError(entry) {
    throw errors$9.missingElement(this._context, entry._key, this._instruction, 'missingFieldsetEntry');
  }

  _untouched() {
    if(!this._touched)
      return this._instruction;

    const untouchedEntry = this._entries().find(entry => !entry._touched);

    return untouchedEntry ? untouchedEntry._instruction : false;
  }

  allEntriesRequired(required = true) {
    this._allEntriesRequired = required;
  }

  /**
   * Assert that all entries inside this fieldset have been touched
   * @param {string} message A static string error message or a message function taking the excess element and returning an error string
   * @param {object} options
   * @param {array} options.except An array of entry keys to exclude from assertion
   * @param {array} options.only Specifies to ignore all entries but the ones includes in this array of element keys
   */
  assertAllTouched(...optional) {
    let message = null;
    let options = {};

    for(const argument of optional) {
      if(typeof argument === 'object') {
        options = argument;
      } else {
        message = argument;
      }
    }

    const entriesMap = this._entries(true);

    for(const [key, entries] of Object.entries(entriesMap)) {
      if(options.hasOwnProperty('except') && options.except.includes(key)) continue;
      if(options.hasOwnProperty('only') && !options.only.includes(key)) continue;

      for(const entry of entries) {
        if(!entry.hasOwnProperty('_touched')) {
          if(typeof message === 'function') {
            message = message(entry);  // TODO: This passes a FieldsetEntry while in section.assertAllTouched passes Element? Inconsisten probably
          }

          throw errors$9.unexpectedElement(this._context, message, entry._instruction); // TODO: Consider all error implementations fetching the _instruction themselves?
        }
      }
    }
  }

  /**
   * Returns the entries of this {@link Fieldset} as an array in the original document order.
   *
   * @param {string} [key] If provided only entries with the specified key are returned.
   * @return {Field[]} The entries of this {@link Fieldset}.
   */
  entries(key = null) {
    this._touched = true;

    if(key === null) {
      return this._entries();
    } else {
      const entriesMap = this._entries(true);

      if(!entriesMap.hasOwnProperty(key))
        return [];

      return entriesMap[key];
    }
  }

  /**
   * Returns the entry with the specified `key`.
   *
   * @param {string} [key] The key of the entry to return. Can be left out to validate and query a single entry with an arbitrary key.
   * @return {Field|MissingField} The entry with the specified key, if available, or a {@link MissingField} proxy instance.
   */
  entry(key = null) {
    return this._entry(key);
  }

  optionalEntry(key = null) {
    return this._entry(key, false);
  }

  /**
   * Returns the parent {@link Section}.
   *
   * @return {Section} The parent section.
   */
  parent() {
    return this._parent || new section.Section(this._context, this._instruction.parent);
  }

  requiredEntry(key = null) {
    return this._entry(key, true);
  }

  /**
   * Returns a debug representation of this {@link Fieldset} in the form of `[object Fieldset key=foo entries=2]`.
   *
   * @return {string} A debug representation of this {@link Fieldset}.
   */
  toString() {
    return `[object Fieldset key=${this._instruction.key} entries=${this._entries().length}]`;
  }

  touch() {
    // TODO: Potentially revisit this - maybe we can do a shallow touch, that is: propagating only to the hierarchy below that was already instantiated,
    //       while marking the deepest initialized element as _touchedRecursive/Deeply or something, which marks a border for _untouched() checks that
    //       does not have to be traversed deeper down. However if after that the hierarchy is used after all, the _touched property should be picked
    //       up starting at the element marked _touchedRecursive, passing the property down below.

    this._touched = true;

    for(const entry of this.entries()) {
      entry._touched = true;
    }
  }
}

var Fieldset_1 = Fieldset;

var fieldset = {
	Fieldset: Fieldset_1
};

const { ValueElementBase: ValueElementBase$3 } = value_element_base;

class FieldsetEntry extends ValueElementBase$3 {
  get [Symbol.toStringTag]() {
    return 'FieldsetEntry';
  }

  parent() {
    return this._parent || new fieldset.Fieldset(this._context, this._instruction.parent);
  }

  toString() {
    return `[object FieldsetEntry key=${this._instruction.key} value=${this._printValue()}]`;
  }
}

var FieldsetEntry_1 = FieldsetEntry;

var fieldset_entry = {
	FieldsetEntry: FieldsetEntry_1
};

const { errors: errors$a } = validation;
const { DOCUMENT: DOCUMENT$7, FIELDSET_ENTRY: FIELDSET_ENTRY$6, LIST_ITEM: LIST_ITEM$7 } = constants;
const { SectionElement: SectionElement$1 } = section_element;

// TODO: parent() implementation on Element and SectionElement ?

class Element extends SectionElement$1 {
  toDocument() {
    if(this._instruction.type !== DOCUMENT$7)
      throw errors$a.unexpectedElementType(this._context, null, this._instruction, 'expectedDocument');

    if(!this._section) {
      this._section = new section_module.Section(this._context, this._instruction); // TODO: parent missing? or: what if casting Element to Field (inherited from SectionElement) but does not have parent because originating from lookup? investigate
      this._yielded = SECTION;
    }

    return this._section;
  }

  toFieldsetEntry() {
    if(!this._fieldsetEntry) {
      if(this._instruction.type !== FIELDSET_ENTRY$6)
        throw errors$a.unexpectedElementType(this._context, null, this._instruction, 'expectedFieldsetEntry');

      this._fieldsetEntry = new fieldset_entry.Fieldset(this._context, this._instruction); // TODO: parent missing? or: what if casting Element to Field (inherited from SectionElement) but does not have parent because originating from lookup? investigate
    }

    return this._fieldsetEntry;
  }

  toListItem() {
    if(!this._listItem) {
      if(this._instruction.type !== LIST_ITEM$7)
        throw errors$a.unexpectedElementType(this._context, null, this._instruction, 'expectedListItem');

      this._listItem = new list_item.ListItem(this._context, this._instruction); // TODO: parent missing? or: what if casting Element to Field (inherited from SectionElement) but does not have parent because originating from lookup? investigate
    }

    return this._listItem;
  }

  toSection() {
    if(!this._section) {
      if(this._instruction.type !== SECTION && this._instruction.type !== DOCUMENT$7)
        throw errors$a.unexpectedElementType(this._context, null, this._instruction, 'expectedSection');

      this._section = new section_module.Section(this._context, this._instruction); // TODO: parent missing? or: what if casting Element to Field (inherited from SectionElement) but does not have parent because originating from lookup? investigate
      this._yielded = SECTION;
    }

    return this._section;
  }

  /**
   * Returns a debug representation of this {@link Element} in the form of `[object Element key=foo yields=field]`.
   *
   * @return {string} A debug representation of this {@link Element}.
   */
  toString() {
    return `[object Element key=${this._key()} yields=${this._yields()}]`;
  }

  yieldsDocument() {
    return this._instruction.type === DOCUMENT$7;
  }

  yieldsFieldsetEntry() {
    return this._instruction.type === FIELDSET_ENTRY$6;
  }

  yieldsListItem() {
    return this._instruction.type === LIST_ITEM$7;
  }

  yieldsSection() {
    return this._instruction.type === SECTION ||
           this._instruction.type === DOCUMENT$7;
  }
}

var Element_1 = Element;

var element = {
	Element: Element_1
};

const { Context: Context$1 } = context;
const { Element: Element$1 } = element;

// TODO: if(element.type === MULTILINE_FIELD_BEGIN) - Here and elsewhere there will be trouble if the multiline field is really COPIED, because then we can't go through .lines (!) revisit boldly

const {
  BEGIN: BEGIN$3,
  END: END$4,
  FIELD: FIELD$8,
  FIELDSET: FIELDSET$7,
  LIST: LIST$7,
  MULTILINE_FIELD_BEGIN: MULTILINE_FIELD_BEGIN$8,
  SECTION: SECTION$9
} = constants;

const checkMultilineFieldByLine = (field, line) => {
  if(line < field.line || line > field.end.line)
    return false;

  if(line === field.line)
    return { element: field, instruction: field };

  if(line === field.end.line)
    return { element: field, instruction: field.end };

  return { element: field, instruction: field.lines.find(valueLine => valueLine.line === line) };
};

const checkMultilineFieldByIndex = (field, index) => {
  if(index < field.ranges.line[BEGIN$3] || index > field.end.ranges.line[END$4])
    return false;

  if(index <= field.ranges.line[END$4])
    return { element: field, instruction: field };

  if(index >= field.end.ranges.line[BEGIN$3])
    return { element: field, instruction: field.end };

  return { element: field, instruction: field.lines.find(line => index <= line.ranges.line[END$4]) };
};

const checkFieldByLine = (field, line) => {
  if(line < field.line)
    return false;

  if(line === field.line)
    return { element: field, instruction: field };

  if(!field.hasOwnProperty('continuations') ||
     field.continuations.length === 0 ||
     line > field.continuations[field.continuations.length - 1].line)
    return false;

  for(const continuation of field.continuations) {
    if(line === continuation.line)
      return { element: field, instruction: continuation };
    if(line < continuation.line)
      return { element: field, instruction: null };
  }
};

const checkFieldByIndex = (field, index) => {
  if(index < field.ranges.line[BEGIN$3])
    return false;

  if(index <= field.ranges.line[END$4])
    return { element: field, instruction: field };

  if(!field.hasOwnProperty('continuations') ||
     field.continuations.length === 0 ||
     index > field.continuations[field.continuations.length - 1].ranges.line[END$4])
    return false;

  for(const continuation of field.continuations) {
    if(index < continuation.ranges.line[BEGIN$3])
      return { element: field, instruction: null };
    if(index <= continuation.ranges.line[END$4])
      return { element: field, instruction: continuation };
  }
};

const checkFieldsetByLine = (fieldset, line) => {
  if(line < fieldset.line)
    return false;

  if(line === fieldset.line)
    return { element: fieldset, instruction: fieldset };

  if(!fieldset.hasOwnProperty('entries') ||
     fieldset.entries.length === 0 ||
     line > fieldset.entries[fieldset.entries.length - 1].line)
    return false;

  for(const entry of fieldset.entries) {
    if(line === entry.line)
      return { element: entry, instruction: entry };

      if(line < entry.line) {
        if(entry.hasOwnProperty('comments') && line >= entry.comments[0].line) {
          return {
            element: entry,
            instruction: entry.comments.find(comment => line == comment.line)
          };
        }
        return { element: fieldset, instruction: null };
      }

    const matchInEntry = checkFieldByLine(entry, line);

    if(matchInEntry)
      return matchInEntry;
  }
};

const checkFieldsetByIndex = (fieldset, index) => {
  if(index < fieldset.ranges.line[BEGIN$3])
    return false;

  if(index <= fieldset.ranges.line[END$4])
    return { element: fieldset, instruction: fieldset };

  if(!fieldset.hasOwnProperty('entries') ||
     fieldset.entries.length === 0 ||
     index > fieldset.entries[fieldset.entries.length - 1].ranges.line[END$4])
    return false;

  for(const entry of fieldset.entries) {
    if(index < entry.ranges.line[BEGIN$3]) {
      if(entry.hasOwnProperty('comments') && index >= entry.comments[0].ranges.line[BEGIN$3]) {
        return {
          element: entry,
          instruction: entry.comments.find(comment => index <= comment.ranges.line[END$4])
        };
      }
      return { element: fieldset, instruction: null };
    }

    if(index <= entry.ranges.line[END$4])
      return { element: entry, instruction: entry };

    const matchInEntry = checkFieldByIndex(entry, index);

    if(matchInEntry)
      return matchInEntry;
  }
};

const checkListByLine = (list, line) => {
  if(line < list.line)
    return false;

  if(line === list.line)
    return { element: list, instruction: list };

  if(!list.hasOwnProperty('items') ||
     line > list.items[list.items.length - 1].line)
    return false;

  for(const item of list.items) {
    if(line === item.line)
      return { element: item, instruction: item };

    if(line < item.line) {
      if(item.hasOwnProperty('comments') && line >= item.comments[0].line) {
        return {
          element: item,
          instruction: item.comments.find(comment => line == comment.line)
        };
      }
      return { element: list, instruction: null };
    }

    const matchInItem = checkFieldByLine(item, line);

    if(matchInItem)
      return matchInItem;
  }
};

const checkListByIndex = (list, index) => {
  if(index < list.ranges.line[BEGIN$3])
    return false;

  if(index <= list.ranges.line[END$4])
    return { element: list, instruction: list };

  if(!list.hasOwnProperty('items') ||
     index > list.items[list.items.length - 1].ranges.line[END$4])
    return false;

  for(const item of list.items) {
    if(index < item.ranges.line[BEGIN$3]) {
      if(item.hasOwnProperty('comments') && index >= item.comments[0].ranges.line[BEGIN$3]) {
        return {
          element: item,
          instruction: item.comments.find(comment => index <= comment.ranges.line[END$4])
        };
      }
      return { element: list, instruction: null };
    }

    if(index <= item.ranges.line[END$4])
      return { element: item, instruction: item };

    const matchInItem = checkFieldByIndex(item, index);

    if(matchInItem)
      return matchInItem;
  }
};

const checkInSectionByLine = (section, line) => {
  for(let elementIndex = section.elements.length - 1; elementIndex >= 0; elementIndex--) {
    const element = section.elements[elementIndex];

    if(element.hasOwnProperty('comments')) {
      if(line < element.comments[0].line) continue;

      if(line <= element.comments[element.comments.length - 1].line) {
        return {
          element: element,
          instruction: element.comments.find(comment => line == comment.line)
        };
      }
    }

    if(element.line > line)
      continue;

    if(element.line === line)
      return { element: element, instruction: element };

    switch(element.type) {
      case FIELD$8: {
        const matchInField = checkFieldByLine(element, line);
        if(matchInField) return matchInField;
        break;
      }
      case FIELDSET$7: {
        const matchInFieldset = checkFieldsetByLine(element, line);
        if(matchInFieldset) return matchInFieldset;
        break;
      }
      case LIST$7: {
        const matchInList = checkListByLine(element, line);
        if(matchInList) return matchInList;
        break;
      }
      case MULTILINE_FIELD_BEGIN$8:
        if(!element.hasOwnProperty('template')) {  // TODO: More elegant copy detection?
          const matchInMultilineField = checkMultilineFieldByLine(element, line);
          if(matchInMultilineField) return matchInMultilineField;
        }
        break;
      case SECTION$9:
        return checkInSectionByLine(element, line);
    }
    break;
  }
  return { element: section, instruction: null };
};

const checkInSectionByIndex = (section, index) => {
  for(let elementIndex = section.elements.length - 1; elementIndex >= 0; elementIndex--) {
    const element = section.elements[elementIndex];

    if(element.hasOwnProperty('comments')) {
      if(index < element.comments[0].ranges.line[BEGIN$3]) continue;

      if(index <= element.comments[element.comments.length - 1].ranges.line[END$4]) {
        return {
          element: element,
          instruction: element.comments.find(comment => index <= comment.ranges.line[END$4])
        };
      }
    }

    if(index < element.ranges.line[BEGIN$3])
      continue;

    if(index <= element.ranges.line[END$4])
      return { element: element, instruction: element };

    switch(element.type) {
      case FIELD$8: {
        const matchInField = checkFieldByIndex(element, index);
        if(matchInField) return matchInField;
        break;
      }
      case FIELDSET$7: {
        const matchInFieldset = checkFieldsetByIndex(element, index);
        if(matchInFieldset) return matchInFieldset;
        break;
      }
      case LIST$7: {
        const matchInList = checkListByIndex(element, index);
        if(matchInList) return matchInList;
        break;
      }
      case MULTILINE_FIELD_BEGIN$8:
        if(!element.hasOwnProperty('template')) {  // TODO: More elegant copy detection?
          const matchInMultilineField = checkMultilineFieldByIndex(element, index);
          if(matchInMultilineField) return matchInMultilineField;
        }
        break;
      case SECTION$9:
        return checkInSectionByIndex(element, index);
    }
    break;
  }
  return { element: section, instruction: null };
};


var lookup_1 = (position, input, options = {}) => {
  let { column, index, line } = position;

  const context = new Context$1(input, options);

  let match;
  if(index === undefined) {
    if(line < 0 || line >= context._lineCount)
      throw new RangeError(`You are trying to look up a line (${line}) outside of the document's line range (0-${context._lineCount - 1})`);

    match = checkInSectionByLine(context._document, line);
  } else {
    if(index < 0 || index > context._input.length)
      throw new RangeError(`You are trying to look up an index (${index}) outside of the document's index range (0-${context._input.length})`);

    match = checkInSectionByIndex(context._document, index);
  }

  const result = {
    element: new Element$1(context, match.element),
    range: null
  };

  let instruction = match.instruction;

  if(!instruction) {
    if(index === undefined) {
      instruction = context._meta.find(instruction => instruction.line === line);
    } else {
      instruction = context._meta.find(instruction =>
        index >= instruction.ranges.line[BEGIN$3] && index <= instruction.ranges.line[END$4]
      );
    }

    if(!instruction)
      return result;
  }

  let rightmostMatch = instruction.ranges.line[0];

  if(index === undefined) {
    index = instruction.ranges.line[0] + column;
  }

  for(const [type, range] of Object.entries(instruction.ranges)) {
    if(type === 'line') continue;

    if(index >= range[BEGIN$3] && index <= range[END$4] && range[BEGIN$3] >= rightmostMatch) {
      result.range = type;
      // TODO: Provide content of range too as convenience
      rightmostMatch = index;
    }
  }

  return result;
};

var lookup = {
	lookup: lookup_1
};

const { Context: Context$2 } = context;
const { Section: Section$1 } = section;

/**
 * Main parser entry point
 * @param {string} input The *content* of an eno document as a string
 * @param {object} options Optional parser settings
 * @param {object} options.locale A custom locale for error messages
 * @param {string} options.source A source label to include in error messages - provide (e.g.) a filename or path to let users know in which file the error occured.
 */
var parse_1 = (input, options = {}) => {
  const context = new Context$2(input, options);

  return new Section$1(context, context._document);
};

var parse = {
	parse: parse_1
};

const { ElementBase: ElementBase$7 } = element_base;
const { List: List$1 } = list;
const { MissingElementBase: MissingElementBase$7 } = missing_element_base;
const { MissingList: MissingList$1 } = missing_list;
const { MissingValueElementBase: MissingValueElementBase$3 } = missing_value_element_base;
const { ValueElementBase: ValueElementBase$4 } = value_element_base;

const _register = (name, func) => {
  if(name.match(/^\s*$/))
    throw new Error('Anonymous functions cannot be registered as loaders, please use register({ myName: myFunc }) or register({ myFunc }) syntax to explicitly provide a name.');

  if(name === 'string')
    throw new Error("You cannot register 'string' as a type/loader with enolib as this conflicts with the native string type accessors.");

  const titleCased = name.replace(/^./, inital => inital.toUpperCase());

  ElementBase$7.prototype[`${name}Key`] = function() { return this.key(func); };
  ElementBase$7.prototype[`optional${titleCased}Comment`] = function() { return this.optionalComment(func); };
  ElementBase$7.prototype[`required${titleCased}Comment`] = function() { return this.requiredComment(func); };
  ValueElementBase$4.prototype[`optional${titleCased}Value`] = function() { return this.optionalValue(func); };
  ValueElementBase$4.prototype[`required${titleCased}Value`] = function() { return this.requiredValue(func); };
  List$1.prototype[`optional${titleCased}Values`] = function() { return this.optionalValues(func); };
  List$1.prototype[`required${titleCased}Values`] = function() { return this.requiredValues(func); };
  MissingElementBase$7.prototype[`${name}Key`] = MissingElementBase$7.prototype.stringKey;
  MissingElementBase$7.prototype[`optional${titleCased}Comment`] = MissingElementBase$7.prototype.optionalStringComment;
  MissingElementBase$7.prototype[`required${titleCased}Comment`] = MissingElementBase$7.prototype.requiredStringComment;
  MissingValueElementBase$3.prototype[`optional${titleCased}Value`] = MissingValueElementBase$3.prototype.optionalStringValue;
  MissingValueElementBase$3.prototype[`required${titleCased}Value`] = MissingValueElementBase$3.prototype.requiredStringValue;
  MissingList$1.prototype[`optional${titleCased}Values`] = MissingList$1.prototype.optionalStringValues;
  MissingList$1.prototype[`required${titleCased}Values`] = MissingList$1.prototype.requiredStringValues;
};

// TODO: Document method signature on the website and here in JSDoc form
/**
 * Globally register loaders in the enolib API
 */
var register_1 = (...definitions) => {
  for(let definition of definitions) {
    if(typeof definition === 'function') {
      _register(definition.name, definition);
    } else /* if(typeof definition === 'object') */ {
      for(let [name, func] of Object.entries(definition)) {
        _register(name, func);
      }
    }
  }
};

var register = {
	register: register_1
};

const { COMMENT: COMMENT$2, HUMAN_INDEXING: HUMAN_INDEXING$3, UNPARSED: UNPARSED$1 } = constants;
const { DISPLAY: DISPLAY$2, EMPHASIZE: EMPHASIZE$3, INDICATE: INDICATE$3, OMISSION: OMISSION$3, QUESTION: QUESTION$3, Reporter: Reporter$3 } = reporter;

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

const BLACK = '\x1b[30m';
const BRIGHT_BLACK = '\x1b[90m';
const WHITE = '\x1b[37m';
const BRIGHT_WHITE = '\x1b[97m';

const BRIGHT_BLACK_BACKGROUND = '\x1b[40m';
const BRIGHT_RED_BACKGROUND = '\x1b[101m';
const WHITE_BACKGROUND = '\x1b[47m';

const INDICATORS$1 = {
  [DISPLAY$2]: ' ',
  [EMPHASIZE$3]: '>',
  [INDICATE$3]: '*',
  [QUESTION$3]: '?'
};

const GUTTER_STYLE = {
  [DISPLAY$2]: BRIGHT_BLACK_BACKGROUND,
  [EMPHASIZE$3]: BLACK + BRIGHT_RED_BACKGROUND,
  [INDICATE$3]: BLACK + WHITE_BACKGROUND,
  [QUESTION$3]: BLACK + WHITE_BACKGROUND
};

const RANGE_STYLE = {
  'elementOperator': WHITE,
  'escapeBeginOperator': WHITE,
  'escapeEndOperator': WHITE,
  'itemOperator': WHITE,
  'entryOperator': WHITE,
  'sectionOperator': WHITE,
  'copyOperator': WHITE,
  'deepCopyOperator': WHITE,
  'multilineFieldOperator': WHITE,
  'directLineContinuationOperator': WHITE,
  'spacedLineContinuationOperator': WHITE,
  'key': BOLD + BRIGHT_WHITE,
  'template': BOLD + BRIGHT_WHITE,
  'value': DIM + WHITE
};

class TerminalReporter extends Reporter$3 {
  constructor(context) {
    super(context);

    let highestShownLineNumber = this._snippet.length;

    for(let index = this._snippet.length; index >= 0; index--) {
      if(this._snippet[index] !== undefined && this._snippet[index] !== OMISSION$3) {
        highestShownLineNumber = index + 1;
        break;
      }
    }

    this._lineNumberPadding = Math.max(4, highestShownLineNumber.toString().length);  // TODO: Pick this up in other reporters
    this._header = '';

    if(context.source) {
      this._header += `${BLACK + BRIGHT_RED_BACKGROUND} ${INDICATORS$1[EMPHASIZE$3]} ${' '.padStart(this._lineNumberPadding)} ${RESET} ${BOLD}${context.source}${RESET}\n`;
    }
  }

  _line(line, tag) {
    if(tag === OMISSION$3)
      return `${DIM + BRIGHT_BLACK_BACKGROUND}${'...'.padStart(this._lineNumberPadding + 2)}  ${RESET}`;

    const number = (line + HUMAN_INDEXING$3).toString();
    const instruction = this._index[line];

    let content = '';
    if(instruction !== undefined) {
      if(instruction.type === COMMENT$2 || instruction.type === UNPARSED$1) {
        content = BRIGHT_BLACK + this._context._input.substring(instruction.ranges.line[0], instruction.ranges.line[1]) + RESET;
      } else {
        content = this._context._input.substring(instruction.ranges.line[0], instruction.ranges.line[1]);

        const ranges = Object.entries(instruction.ranges).filter(([name, _]) => name !== 'line');

        ranges.sort((a,b) => a[1][0] < b[1][0] ? 1 : -1);

        for(const [name, range] of ranges) {
          const before = content.substring(0, range[0] - instruction.ranges.line[0]);
          const after = content.substring(range[1] - instruction.ranges.line[0]);

          content = before + RANGE_STYLE[name] + this._context._input.substring(range[0], range[1]) + RESET + after;
        }
      }
    }

    return `${GUTTER_STYLE[tag]} ${INDICATORS$1[tag]} ${number.padStart(this._lineNumberPadding)} ${RESET} ${content}`;
  }

  _print() {
    const snippet = this._snippet.map((tag, line) => this._line(line, tag))
                                 .filter(line => line !== undefined)
                                 .join('\n');

    return this._header + snippet;
  }
}

var TerminalReporter_1 = TerminalReporter;

var terminal_reporter = {
	TerminalReporter: TerminalReporter_1
};

var EnoError$1 = error_types.EnoError;
var HtmlReporter$1 = html_reporter.HtmlReporter;
var lookup$1 = lookup.lookup;
var parse$1 = parse.parse;
var ParseError$2 = error_types.ParseError;
var register$1 = register.register;
var TerminalReporter$1 = terminal_reporter.TerminalReporter;
var TextReporter$2 = text_reporter.TextReporter;
var ValidationError$2 = error_types.ValidationError;

var main = {
	EnoError: EnoError$1,
	HtmlReporter: HtmlReporter$1,
	lookup: lookup$1,
	parse: parse$1,
	ParseError: ParseError$2,
	register: register$1,
	TerminalReporter: TerminalReporter$1,
	TextReporter: TextReporter$2,
	ValidationError: ValidationError$2
};

var moment = createCommonjsModule(function (module, exports) {
(function (global, factory) {
     module.exports = factory() ;
}(commonjsGlobal, (function () {
    var hookCallback;

    function hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isObject(input) {
        // IE8 will treat undefined and null as object if it wasn't for
        // input != null
        return input != null && Object.prototype.toString.call(input) === '[object Object]';
    }

    function isObjectEmpty(obj) {
        if (Object.getOwnPropertyNames) {
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isUndefined(input) {
        return input === void 0;
    }

    function isNumber(input) {
        return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null,
            rfc2822         : false,
            weekdayMismatch : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            var isNowValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.weekdayMismatch &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                isNowValid = isNowValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }

            if (Object.isFrozen == null || !Object.isFrozen(m)) {
                m._isValid = isNowValid;
            }
            else {
                return isNowValid;
            }
        }
        return m._isValid;
    }

    function createInvalid (flags) {
        var m = createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i = 0; i < momentProperties.length; i++) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        if (!this.isValid()) {
            this._d = new Date(NaN);
        }
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            // -0 -> 0
            return Math.ceil(number) || 0;
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                var args = [];
                var arg;
                for (var i = 0; i < arguments.length; i++) {
                    arg = '';
                    if (typeof arguments[i] === 'object') {
                        arg += '\n[' + i + '] ';
                        for (var key in arguments[0]) {
                            arg += key + ': ' + arguments[0][key] + ', ';
                        }
                        arg = arg.slice(0, -2); // Remove trailing comma and space
                    } else {
                        arg = arguments[i];
                    }
                    args.push(arg);
                }
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    hooks.suppressDeprecationWarnings = false;
    hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
        // TODO: Remove "ordinalParse" fallback in next major release.
        this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])) {
                // make sure changes to properties don't modify parent config
                res[prop] = extend({}, res[prop]);
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function calendar (key, mom, now) {
        var output = this._calendar[key] || this._calendar['sameElse'];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        ss : '%d seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    var priorities = {};

    function addUnitPriority(unit, priority) {
        priorities[unit] = priority;
    }

    function getPrioritizedUnits(unitsObj) {
        var units = [];
        for (var u in unitsObj) {
            units.push({unit: u, priority: priorities[u]});
        }
        units.sort(function (a, b) {
            return a.priority - b.priority;
        });
        return units;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (isNumber(callback)) {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PRIORITIES

    addUnitPriority('year', 1);

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                set$1(this, unit, value);
                hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get(this, unit);
            }
        };
    }

    function get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function set$1 (mom, unit, value) {
        if (mom.isValid() && !isNaN(value)) {
            if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
            }
            else {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
            }
        }
    }

    // MOMENTS

    function stringGet (units) {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units]();
        }
        return this;
    }


    function stringSet (units, value) {
        if (typeof units === 'object') {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units);
            for (var i = 0; i < prioritized.length; i++) {
                this[prioritized[i].unit](units[prioritized[i].unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function mod(n, x) {
        return ((n % x) + x) % x;
    }

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        if (isNaN(year) || isNaN(month)) {
            return NaN;
        }
        var modMonth = mod(month, 12);
        year += (month - modMonth) / 12;
        return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PRIORITY

    addUnitPriority('month', 8);

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        if (!m) {
            return isArray(this._months) ? this._months :
                this._months['standalone'];
        }
        return isArray(this._months) ? this._months[m.month()] :
            this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort :
                this._monthsShort['standalone'];
        }
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (!isNumber(value)) {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
        } else {
            return get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsShortRegex')) {
                this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsRegex')) {
                this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
        }
        for (i = 0; i < 24; i++) {
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function createDate (y, m, d, h, M, s, ms) {
        // can't just apply() to create a date:
        // https://stackoverflow.com/q/181348
        var date;
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
                date.setFullYear(y);
            }
        } else {
            date = new Date(y, m, d, h, M, s, ms);
        }

        return date;
    }

    function createUTCDate (y) {
        var date;
        // the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            var args = Array.prototype.slice.call(arguments);
            // preserve leap years using a full 400 year cycle, then reset
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
                date.setUTCFullYear(y);
            }
        } else {
            date = new Date(Date.UTC.apply(null, arguments));
        }

        return date;
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PRIORITIES

    addUnitPriority('week', 5);
    addUnitPriority('isoWeek', 5);

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 6th is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PRIORITY
    addUnitPriority('day', 11);
    addUnitPriority('weekday', 11);
    addUnitPriority('isoWeekday', 11);

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    function parseIsoWeekday(input, locale) {
        if (typeof input === 'string') {
            return locale.weekdaysParse(input) % 7 || 7;
        }
        return isNaN(input) ? null : input;
    }

    // LOCALES
    function shiftWeekdays (ws, n) {
        return ws.slice(n, 7).concat(ws.slice(0, n));
    }

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        var weekdays = isArray(this._weekdays) ? this._weekdays :
            this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
        return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
            : (m) ? weekdays[m.day()] : weekdays;
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
            : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
            : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
    }

    function handleStrictParse$1(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }

        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.

        if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
        } else {
            return this.day() || 7;
        }
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PRIORITY
    addUnitPriority('hour', 13);

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('k',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);
    addRegexToken('kk', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['k', 'kk'], function (input, array, config) {
        var kInput = toInt(input);
        array[HOUR] = kInput === 24 ? 0 : kInput;
    });
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour they want. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    var baseConfig = {
        calendar: defaultCalendar,
        longDateFormat: defaultLongDateFormat,
        invalidDate: defaultInvalidDate,
        ordinal: defaultOrdinal,
        dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
        relativeTime: defaultRelativeTime,

        months: defaultLocaleMonths,
        monthsShort: defaultLocaleMonthsShort,

        week: defaultLocaleWeek,

        weekdays: defaultLocaleWeekdays,
        weekdaysMin: defaultLocaleWeekdaysMin,
        weekdaysShort: defaultLocaleWeekdaysShort,

        meridiemParse: defaultLocaleMeridiemParse
    };

    // internal storage for locale config files
    var locales = {};
    var localeFamilies = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return globalLocale;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && ('object' !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                var aliasedRequire = commonjsRequire;
                aliasedRequire('./locale/' + name);
                getSetGlobalLocale(oldLocale);
            } catch (e) {}
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
            else {
                if ((typeof console !==  'undefined') && console.warn) {
                    //warn user if arguments are passed but the locale could not be set
                    console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                }
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            var locale, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale ' +
                        'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    parentConfig = locales[config.parentLocale]._config;
                } else {
                    locale = loadLocale(config.parentLocale);
                    if (locale != null) {
                        parentConfig = locale._config;
                    } else {
                        if (!localeFamilies[config.parentLocale]) {
                            localeFamilies[config.parentLocale] = [];
                        }
                        localeFamilies[config.parentLocale].push({
                            name: name,
                            config: config
                        });
                        return null;
                    }
                }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));

            if (localeFamilies[name]) {
                localeFamilies[name].forEach(function (x) {
                    defineLocale(x.name, x.config);
                });
            }

            // backwards compat for now: also set the locale
            // make sure we set the locale AFTER all child locales have been
            // created, so we won't end up with the child locale set.
            getSetGlobalLocale(name);


            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale, tmpLocale, parentConfig = baseConfig;
            // MERGE
            tmpLocale = loadLocale(name);
            if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
            }
            config = mergeConfigs(parentConfig, config);
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function listLocales() {
        return keys(locales);
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, expectedWeekday, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }

        // check for mismatching day of week
        if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            var curWeek = weekOfYear(createLocal(), dow, doy);

            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

            // Default to current week.
            week = defaults(w.w, curWeek.week);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from beginning of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to beginning of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

    function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
        var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
        ];

        if (secondStr) {
            result.push(parseInt(secondStr, 10));
        }

        return result;
    }

    function untruncateYear(yearStr) {
        var year = parseInt(yearStr, 10);
        if (year <= 49) {
            return 2000 + year;
        } else if (year <= 999) {
            return 1900 + year;
        }
        return year;
    }

    function preprocessRFC2822(s) {
        // Remove comments and folding whitespace and replace multiple-spaces with a single space
        return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function checkWeekday(weekdayStr, parsedInput, config) {
        if (weekdayStr) {
            // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
            if (weekdayProvided !== weekdayActual) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return false;
            }
        }
        return true;
    }

    var obsOffsets = {
        UT: 0,
        GMT: 0,
        EDT: -4 * 60,
        EST: -5 * 60,
        CDT: -5 * 60,
        CST: -6 * 60,
        MDT: -6 * 60,
        MST: -7 * 60,
        PDT: -7 * 60,
        PST: -8 * 60
    };

    function calculateOffset(obsOffset, militaryOffset, numOffset) {
        if (obsOffset) {
            return obsOffsets[obsOffset];
        } else if (militaryOffset) {
            // the only allowed military tz is Z
            return 0;
        } else {
            var hm = parseInt(numOffset, 10);
            var m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
        }
    }

    // date and time from ref 2822 format
    function configFromRFC2822(config) {
        var match = rfc2822.exec(preprocessRFC2822(config._i));
        if (match) {
            var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
            if (!checkWeekday(match[1], parsedArray, config)) {
                return;
            }

            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);

            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

            getParsingFlags(config).rfc2822 = true;
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        configFromRFC2822(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        // Final attempt, use Input Fallback
        hooks.createFromInputFallback(config);
    }

    hooks.createFromInputFallback = deprecate(
        'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
        'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
        'discouraged and will be removed in an upcoming major release. Please refer to ' +
        'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // constant that refers to the ISO standard
    hooks.ISO_8601 = function () {};

    // constant that refers to the RFC 2822 form
    hooks.RFC_2822 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
        }
        if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
        }
        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._a[HOUR] <= 12 &&
            getParsingFlags(config).bigHour === true &&
            config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isDate(input)) {
            config._d = input;
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        }  else {
            configFromInput(config);
        }

        if (!isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (isUndefined(input)) {
            config._d = new Date(hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (isObject(input)) {
            configFromObject(config);
        } else if (isNumber(input)) {
            // from milliseconds
            config._d = new Date(input);
        } else {
            hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (locale === true || locale === false) {
            strict = locale;
            locale = undefined;
        }

        if ((isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)) {
            input = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
        'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other < this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

    function isDurationValid(m) {
        for (var key in m) {
            if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                return false;
            }
        }

        var unitHasDecimal = false;
        for (var i = 0; i < ordering.length; ++i) {
            if (m[ordering[i]]) {
                if (unitHasDecimal) {
                    return false; // only allow non-integers for smallest unit
                }
                if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                    unitHasDecimal = true;
                }
            }
        }

        return true;
    }

    function isValid$1() {
        return this._isValid;
    }

    function createInvalid$1() {
        return createDuration(NaN);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        this._isValid = isDurationValid(normalizedInput);

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible to translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = (string || '').match(matcher);

        if (matches === null) {
            return null;
        }

        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return minutes === 0 ?
          0 :
          parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            hooks.updateOffset(res, false);
            return res;
        } else {
            return createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime, keepMinutes) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
                if (input === null) {
                    return this;
                }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
        } else if (typeof this._i === 'string') {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
                this.utcOffset(tZone);
            }
            else {
                this.utcOffset(0, true);
            }
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

    function createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (isNumber(input)) {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])                         * sign,
                h  : toInt(match[HOUR])                         * sign,
                m  : toInt(match[MINUTE])                       * sign,
                s  : toInt(match[SECOND])                       * sign,
                ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    createDuration.fn = Duration.prototype;
    createDuration.invalid = createInvalid$1;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
        };
    }

    function addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (months) {
            setMonth(mom, get(mom, 'Month') + months * isAdding);
        }
        if (days) {
            set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
        }
        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (updateOffset) {
            hooks.updateOffset(mom, days || months);
        }
    }

    var add      = createAdder(1, 'add');
    var subtract = createAdder(-1, 'subtract');

    function getCalendarFormat(myMoment, now) {
        var diff = myMoment.diff(now, 'days', true);
        return diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
    }

    function calendar$1 (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            format = hooks.calendarFormat(this, sod) || 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        var localFrom = isMoment(from) ? from : createLocal(from),
            localTo = isMoment(to) ? to : createLocal(to);
        if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
        }
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input, units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input, units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        switch (units) {
            case 'year': output = monthDiff(this, that) / 12; break;
            case 'month': output = monthDiff(this, that); break;
            case 'quarter': output = monthDiff(this, that) / 3; break;
            case 'second': output = (this - that) / 1e3; break; // 1000
            case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
            case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
            case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
            case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
            default: output = this - that;
        }

        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function toISOString(keepOffset) {
        if (!this.isValid()) {
            return null;
        }
        var utc = keepOffset !== true;
        var m = utc ? this.clone().utc() : this;
        if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
        }
        if (isFunction(Date.prototype.toISOString)) {
            // native implementation is ~50x faster, use it when we can
            if (utc) {
                return this.toDate().toISOString();
            } else {
                return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
            }
        }
        return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }

    /**
     * Return a human readable representation of a moment that can
     * also be evaluated to get a new moment which is the same
     *
     * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
     */
    function inspect () {
        if (!this.isValid()) {
            return 'moment.invalid(/* ' + this._i + ' */)';
        }
        var func = 'moment';
        var zone = '';
        if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
            zone = 'Z';
        }
        var prefix = '[' + func + '("]';
        var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
        var datetime = '-MM-DD[T]HH:mm:ss.SSS';
        var suffix = zone + '[")]';

        return this.format(prefix + year + datetime + suffix);
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

    // actual modulo - handles negative numbers (for dates before 1970):
    function mod$1(dividend, divisor) {
        return (dividend % divisor + divisor) % divisor;
    }

    function localStartOfDate(y, m, d) {
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return new Date(y, m, d).valueOf();
        }
    }

    function utcStartOfDate(y, m, d) {
        // Date.UTC remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return Date.UTC(y, m, d);
        }
    }

    function startOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year(), 0, 1);
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                break;
            case 'month':
                time = startOfDate(this.year(), this.month(), 1);
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date());
                break;
            case 'hour':
                time = this._d.valueOf();
                time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                break;
            case 'minute':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_MINUTE);
                break;
            case 'second':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_SECOND);
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function endOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year() + 1, 0, 1) - 1;
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                break;
            case 'month':
                time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                break;
            case 'hour':
                time = this._d.valueOf();
                time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                break;
            case 'minute':
                time = this._d.valueOf();
                time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                break;
            case 'second':
                time = this._d.valueOf();
                time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return new Date(this.valueOf());
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function isValid$2 () {
        return isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PRIORITY

    addUnitPriority('weekYear', 1);
    addUnitPriority('isoWeekYear', 1);


    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PRIORITY

    addUnitPriority('quarter', 7);

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PRIORITY
    addUnitPriority('date', 9);

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        // TODO: Remove "ordinalParse" fallback in next major release.
        return isStrict ?
          (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
          locale._dayOfMonthOrdinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0]);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PRIORITY
    addUnitPriority('dayOfYear', 4);

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PRIORITY

    addUnitPriority('minute', 14);

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PRIORITY

    addUnitPriority('second', 15);

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PRIORITY

    addUnitPriority('millisecond', 16);

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var proto = Moment.prototype;

    proto.add               = add;
    proto.calendar          = calendar$1;
    proto.clone             = clone;
    proto.diff              = diff;
    proto.endOf             = endOf;
    proto.format            = format;
    proto.from              = from;
    proto.fromNow           = fromNow;
    proto.to                = to;
    proto.toNow             = toNow;
    proto.get               = stringGet;
    proto.invalidAt         = invalidAt;
    proto.isAfter           = isAfter;
    proto.isBefore          = isBefore;
    proto.isBetween         = isBetween;
    proto.isSame            = isSame;
    proto.isSameOrAfter     = isSameOrAfter;
    proto.isSameOrBefore    = isSameOrBefore;
    proto.isValid           = isValid$2;
    proto.lang              = lang;
    proto.locale            = locale;
    proto.localeData        = localeData;
    proto.max               = prototypeMax;
    proto.min               = prototypeMin;
    proto.parsingFlags      = parsingFlags;
    proto.set               = stringSet;
    proto.startOf           = startOf;
    proto.subtract          = subtract;
    proto.toArray           = toArray;
    proto.toObject          = toObject;
    proto.toDate            = toDate;
    proto.toISOString       = toISOString;
    proto.inspect           = inspect;
    proto.toJSON            = toJSON;
    proto.toString          = toString;
    proto.unix              = unix;
    proto.valueOf           = valueOf;
    proto.creationData      = creationData;
    proto.year       = getSetYear;
    proto.isLeapYear = getIsLeapYear;
    proto.weekYear    = getSetWeekYear;
    proto.isoWeekYear = getSetISOWeekYear;
    proto.quarter = proto.quarters = getSetQuarter;
    proto.month       = getSetMonth;
    proto.daysInMonth = getDaysInMonth;
    proto.week           = proto.weeks        = getSetWeek;
    proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
    proto.weeksInYear    = getWeeksInYear;
    proto.isoWeeksInYear = getISOWeeksInYear;
    proto.date       = getSetDayOfMonth;
    proto.day        = proto.days             = getSetDayOfWeek;
    proto.weekday    = getSetLocaleDayOfWeek;
    proto.isoWeekday = getSetISODayOfWeek;
    proto.dayOfYear  = getSetDayOfYear;
    proto.hour = proto.hours = getSetHour;
    proto.minute = proto.minutes = getSetMinute;
    proto.second = proto.seconds = getSetSecond;
    proto.millisecond = proto.milliseconds = getSetMillisecond;
    proto.utcOffset            = getSetOffset;
    proto.utc                  = setOffsetToUTC;
    proto.local                = setOffsetToLocal;
    proto.parseZone            = setOffsetToParsedOffset;
    proto.hasAlignedHourOffset = hasAlignedHourOffset;
    proto.isDST                = isDaylightSavingTime;
    proto.isLocal              = isLocal;
    proto.isUtcOffset          = isUtcOffset;
    proto.isUtc                = isUtc;
    proto.isUTC                = isUtc;
    proto.zoneAbbr = getZoneAbbr;
    proto.zoneName = getZoneName;
    proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
    proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

    function createUnix (input) {
        return createLocal(input * 1000);
    }

    function createInZone () {
        return createLocal.apply(null, arguments).parseZone();
    }

    function preParsePostFormat (string) {
        return string;
    }

    var proto$1 = Locale.prototype;

    proto$1.calendar        = calendar;
    proto$1.longDateFormat  = longDateFormat;
    proto$1.invalidDate     = invalidDate;
    proto$1.ordinal         = ordinal;
    proto$1.preparse        = preParsePostFormat;
    proto$1.postformat      = preParsePostFormat;
    proto$1.relativeTime    = relativeTime;
    proto$1.pastFuture      = pastFuture;
    proto$1.set             = set;

    proto$1.months            =        localeMonths;
    proto$1.monthsShort       =        localeMonthsShort;
    proto$1.monthsParse       =        localeMonthsParse;
    proto$1.monthsRegex       = monthsRegex;
    proto$1.monthsShortRegex  = monthsShortRegex;
    proto$1.week = localeWeek;
    proto$1.firstDayOfYear = localeFirstDayOfYear;
    proto$1.firstDayOfWeek = localeFirstDayOfWeek;

    proto$1.weekdays       =        localeWeekdays;
    proto$1.weekdaysMin    =        localeWeekdaysMin;
    proto$1.weekdaysShort  =        localeWeekdaysShort;
    proto$1.weekdaysParse  =        localeWeekdaysParse;

    proto$1.weekdaysRegex       =        weekdaysRegex;
    proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
    proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

    proto$1.isPM = localeIsPM;
    proto$1.meridiem = localeMeridiem;

    function get$1 (format, index, field, setter) {
        var locale = getLocale();
        var utc = createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return get$1(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = get$1(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return get$1(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = get$1(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    getSetGlobalLocale('en', {
        dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports

    hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
    hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

    var mathAbs = Math.abs;

    function abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function addSubtract$1 (duration, input, value, direction) {
        var other = createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function add$1 (input, value) {
        return addSubtract$1(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function subtract$1 (input, value) {
        return addSubtract$1(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        if (!this.isValid()) {
            return NaN;
        }
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'quarter' || units === 'year') {
            days = this._days + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            switch (units) {
                case 'month':   return months;
                case 'quarter': return months / 3;
                case 'year':    return months / 12;
            }
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function valueOf$1 () {
        if (!this.isValid()) {
            return NaN;
        }
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asQuarters     = makeAs('Q');
    var asYears        = makeAs('y');

    function clone$1 () {
        return createDuration(this);
    }

    function get$2 (units) {
        units = normalizeUnits(units);
        return this.isValid() ? this[units + 's']() : NaN;
    }

    function makeGetter(name) {
        return function () {
            return this.isValid() ? this._data[name] : NaN;
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        ss: 44,         // a few seconds to seconds
        s : 45,         // seconds to minute
        m : 45,         // minutes to hour
        h : 22,         // hours to day
        d : 26,         // days to month
        M : 11          // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
        var duration = createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds <= thresholds.ss && ['s', seconds]  ||
                seconds < thresholds.s   && ['ss', seconds] ||
                minutes <= 1             && ['m']           ||
                minutes < thresholds.m   && ['mm', minutes] ||
                hours   <= 1             && ['h']           ||
                hours   < thresholds.h   && ['hh', hours]   ||
                days    <= 1             && ['d']           ||
                days    < thresholds.d   && ['dd', days]    ||
                months  <= 1             && ['M']           ||
                months  < thresholds.M   && ['MM', months]  ||
                years   <= 1             && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set the rounding function for relative time strings
    function getSetRelativeTimeRounding (roundingFunction) {
        if (roundingFunction === undefined) {
            return round;
        }
        if (typeof(roundingFunction) === 'function') {
            round = roundingFunction;
            return true;
        }
        return false;
    }

    // This function allows you to set a threshold for relative time strings
    function getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        if (threshold === 's') {
            thresholds.ss = limit - 1;
        }
        return true;
    }

    function humanize (withSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var locale = this.localeData();
        var output = relativeTime$1(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var abs$1 = Math.abs;

    function sign(x) {
        return ((x > 0) - (x < 0)) || +x;
    }

    function toISOString$1() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var seconds = abs$1(this._milliseconds) / 1000;
        var days         = abs$1(this._days);
        var months       = abs$1(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        var totalSign = total < 0 ? '-' : '';
        var ymSign = sign(this._months) !== sign(total) ? '-' : '';
        var daysSign = sign(this._days) !== sign(total) ? '-' : '';
        var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

        return totalSign + 'P' +
            (Y ? ymSign + Y + 'Y' : '') +
            (M ? ymSign + M + 'M' : '') +
            (D ? daysSign + D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? hmsSign + h + 'H' : '') +
            (m ? hmsSign + m + 'M' : '') +
            (s ? hmsSign + s + 'S' : '');
    }

    var proto$2 = Duration.prototype;

    proto$2.isValid        = isValid$1;
    proto$2.abs            = abs;
    proto$2.add            = add$1;
    proto$2.subtract       = subtract$1;
    proto$2.as             = as;
    proto$2.asMilliseconds = asMilliseconds;
    proto$2.asSeconds      = asSeconds;
    proto$2.asMinutes      = asMinutes;
    proto$2.asHours        = asHours;
    proto$2.asDays         = asDays;
    proto$2.asWeeks        = asWeeks;
    proto$2.asMonths       = asMonths;
    proto$2.asQuarters     = asQuarters;
    proto$2.asYears        = asYears;
    proto$2.valueOf        = valueOf$1;
    proto$2._bubble        = bubble;
    proto$2.clone          = clone$1;
    proto$2.get            = get$2;
    proto$2.milliseconds   = milliseconds;
    proto$2.seconds        = seconds;
    proto$2.minutes        = minutes;
    proto$2.hours          = hours;
    proto$2.days           = days;
    proto$2.weeks          = weeks;
    proto$2.months         = months;
    proto$2.years          = years;
    proto$2.humanize       = humanize;
    proto$2.toISOString    = toISOString$1;
    proto$2.toString       = toISOString$1;
    proto$2.toJSON         = toISOString$1;
    proto$2.locale         = locale;
    proto$2.localeData     = localeData;

    proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
    proto$2.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    hooks.version = '2.24.0';

    setHookCallback(createLocal);

    hooks.fn                    = proto;
    hooks.min                   = min;
    hooks.max                   = max;
    hooks.now                   = now;
    hooks.utc                   = createUTC;
    hooks.unix                  = createUnix;
    hooks.months                = listMonths;
    hooks.isDate                = isDate;
    hooks.locale                = getSetGlobalLocale;
    hooks.invalid               = createInvalid;
    hooks.duration              = createDuration;
    hooks.isMoment              = isMoment;
    hooks.weekdays              = listWeekdays;
    hooks.parseZone             = createInZone;
    hooks.localeData            = getLocale;
    hooks.isDuration            = isDuration;
    hooks.monthsShort           = listMonthsShort;
    hooks.weekdaysMin           = listWeekdaysMin;
    hooks.defineLocale          = defineLocale;
    hooks.updateLocale          = updateLocale;
    hooks.locales               = listLocales;
    hooks.weekdaysShort         = listWeekdaysShort;
    hooks.normalizeUnits        = normalizeUnits;
    hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
    hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
    hooks.calendarFormat        = getCalendarFormat;
    hooks.prototype             = proto;

    // currently HTML5 input type only supports 24-hour formats
    hooks.HTML5_FMT = {
        DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
        DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
        DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
        DATE: 'YYYY-MM-DD',                             // <input type="date" />
        TIME: 'HH:mm',                                  // <input type="time" />
        TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
        TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
        WEEK: 'GGGG-[W]WW',                             // <input type="week" />
        MONTH: 'YYYY-MM'                                // <input type="month" />
    };

    return hooks;

})));
});

const dayHeader = (dayText) => html`
	<tr class="separator">
      <td colspan="3">${dayText}</td>
    </tr>
    `;
const singleEvent = (time, eventText, host) => html`
	<tr>
	  <td class="time">${time}</td>
	  <td class="event">${eventText}</td>
	  <td class="host">${host}</td>
	</tr>
`;

const scheduleTemplate = (scheduleData) => {
	let dayTemplates = [];
	const dayFormat = 'dddd, LL';
	const timeFormat = 'hh:mm A';
	
	scheduleData.eventsByDay.forEach( events => {
		// All events in this day should have the same day
		// Gonna arbitrarily pick the first day 
		const dayText = moment(events[0].time).format(dayFormat);
		
		dayTemplates.push( dayHeader(dayText) );

		events.forEach( event => {
			const timeText = moment(event.time).format(timeFormat); 
			dayTemplates.push( singleEvent(timeText, event.name, event.host) );
		});

	});

	return html`${dayTemplates}`

};

const headerTemplate = (title, tz) => html`
	<h1>${title}</h1>
	<p>Time is automatically set to the detected timezone (${tz})
`;


async function processInput(filename) {
	// TODO: Error and format checking
	const response = await fetch(filename);
	const input = await response.text();
	const doc = main.parse(input, { source: filename});

	// Convert timezone e.g. 
	// from 7 to +07, from -6 to -06
	// 0 should also be converted to +0 
	let tz = doc.field('Timezone').requiredStringValue();
	if (tz[0] != "+" && tz[0] != "-") {
		tz = "+" + tz;
	}
	if (tz[2] === undefined) {
		tz = tz.slice(0,1) + "0" + tz[1]; 
	}

	let scheduleData = { 
		tz,
		title: doc.field('Title').optionalStringValue(), 
		events: []
	};


	function isDaySection(el) {
		const isSection = el.yieldsSection();
		const isDay = el.stringKey().slice(0,3) === "Day";
		return isSection && isDay
	}

	function processDay(daySection) {
		const rawDate = daySection.field('Date').requiredStringValue();
		let formattedEvents = [];

		daySection.sections('Event').forEach(event => {
			let name = event.field('Name').optionalStringValue();
			let host = event.field('Host').optionalStringValue();
			let rawTime = event.field('Time').requiredStringValue();
			
			// Format time to 24-hour 
			rawTime = moment(rawTime, 'LTS').format('HH:MM');

			let time = `${rawDate} ${rawTime}${tz}`; 

			let formattedEvent = { name, host, time };

			formattedEvents.push(formattedEvent);
		});

		return formattedEvents
	}

	function divideByLocalDay(events) {
		let dayEvents = [];

		events.forEach(event => {
			// If it's the first event, just add
			// a new day
			if (dayEvents.length <= 0) {
				dayEvents.push([event]);
				return
			}

			let todayEvents = dayEvents[dayEvents.length - 1];
			let today = todayEvents[0].time;

			// If it's the same date as today, add the event to today
			// Otherwise, make a new day array
			if ( moment(event.time).isSame(today, 'day') ) {
				todayEvents.push(event);
			}
			else {
				dayEvents.push([event]);
			}

		});

		return dayEvents

	}

	doc.elements().forEach(el => {
		if (isDaySection(el)) {
			let dayEvents = processDay( doc.section(el.stringKey()) );
			dayEvents.forEach(event => {
				scheduleData.events.push(event);
			});
		}
	});

	scheduleData.eventsByDay = divideByLocalDay(scheduleData.events);

	return scheduleData
}

window.addEventListener('DOMContentLoaded', async () => {

	let scheduleContainer = document.getElementById('awakening-schedule');
	let scheduleBody = scheduleContainer.querySelector('tbody');
	let headerBody = document.querySelector('header');

	const scheduleData = await processInput('awakening.eno'); 
	console.log(scheduleData);

	render(scheduleTemplate(scheduleData), scheduleBody);
	render(headerTemplate(scheduleData.title, moment().format('Z')), headerBody);

});
