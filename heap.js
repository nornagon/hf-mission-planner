// Copyright 2006 The Closure Library Authors. All Rights Reserved.
// Modified 2019 by Jeremy Apthorp.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Datastructure: Heap.
 *
 *
 * This file provides the implementation of a Heap datastructure. Smaller keys
 * rise to the top.
 *
 * The big-O notation for all operations are below:
 * <pre>
 *  Method          big-O
 * ----------------------------------------------------------------------------
 * - insert         O(logn)
 * - remove         O(logn)
 * - peek           O(1)
 * - contains       O(n)
 * </pre>
 */


class Node {
  constructor(key, value) {
    this.key_ = key
    this.value_ = value
  }
  getKey() { return this.key_ }
  getValue() { return this.value_ }
  clone() { return new Node(this.key_, this.value_) }
}

class Heap {
  constructor(opt_heap) {
    this.nodes_ = []
    if (opt_heap) {
      this.insertAll(opt_heap);
    }
  }

  /** Insert the given value into the heap with the given key. */
  insert(key, value) {
    const node = new Node(key, value)
    const nodes = this.nodes_
    nodes.push(node)
    this.moveUp_(nodes.length - 1)
  }

  /** Adds multiple key-value pairs from another Heap or Object */
  insertAll(heap) {
    let keys, values;
    if (heap instanceof Heap) {
      keys = heap.getKeys()
      values = heap.getValues()

      // If it is a heap and the current heap is empty, I can rely on the fact
      // that the keys/values are in the correct order to put in the underlying
      // structure.
      if (this.getCount() <= 0) {
        const nodes = this.nodes_
        for (var i = 0; i < keys.length; i++) {
          nodes.push(new Node(keys[i], values[i]))
        }
        return
      }
    } else {
      keys = Object.keys(heap)
      values = Object.values(heap)
    }

    for (let i = 0; i < keys.length; i++) {
      this.insert(keys[i], values[i])
    }
  }

  /** Retrieves and removes the root value of this heap. Returns undefined if the heap is empty. */
  remove() {
    const nodes = this.nodes_
    const count = nodes.length
    const rootNode = nodes[0]
    if (count <= 0) {
      return undefined
    } else if (count == 1) {
      nodes.length = 0
    } else {
      nodes[0] = nodes.pop()
      this.moveDown_(0)
    }
    return rootNode.getValue()
  }

  /** Retrieves but does not remove the root value of this heap. Returns undefined if the heap is empty. */
  peek() {
    const nodes = this.nodes_
    if (nodes.length == 0) {
      return undefined
    }
    return nodes[0].getValue()
  }
  /** Retrieves but does not remove the key of the root node of this heap. Returns undefined if the heap is empty. */
  peekKey() {
    return this.nodes_[0] && this.nodes_[0].getKey()
  }

  /**
   * Moves the node at the given index down to its proper place in the heap.
   * @param {number} index The index of the node to move down.
   * @private
   */
  moveDown_(index) {
    const nodes = this.nodes_
    const count = nodes.length

    // Save the node being moved down.
    const node = nodes[index]
    // While the current node has a child.
    while (index < (count >> 1)) {
      var leftChildIndex = this.getLeftChildIndex_(index)
      var rightChildIndex = this.getRightChildIndex_(index)

      // Determine the index of the smaller child.
      var smallerChildIndex = rightChildIndex < count &&
              nodes[rightChildIndex].getKey() < nodes[leftChildIndex].getKey() ?
          rightChildIndex :
          leftChildIndex

      // If the node being moved down is smaller than its children, the node
      // has found the correct index it should be at.
      if (nodes[smallerChildIndex].getKey() > node.getKey()) {
        break
      }

      // If not, then take the smaller child as the current node.
      nodes[index] = nodes[smallerChildIndex]
      index = smallerChildIndex
    }
    nodes[index] = node
  }

  /** Moves the node at the given index up to its proper place in the heap. */
  moveUp_(index) {
    const nodes = this.nodes_
    const node = nodes[index]

    // While the node being moved up is not at the root.
    while (index > 0) {
      // If the parent is less than the node being moved up, move the parent down.
      var parentIndex = this.getParentIndex_(index)
      if (nodes[parentIndex].getKey() > node.getKey()) {
        nodes[index] = nodes[parentIndex]
        index = parentIndex
      } else {
        break
      }
    }
    nodes[index] = node
  }

  /** Gets the index of the left child of the node at the given index. */
  getLeftChildIndex_(index) {
    return index * 2 + 1
  }

  /** Gets the index of the right child of the node at the given index. */
  getRightChildIndex_(index) {
    return index * 2 + 2
  }

  /** Gets the index of the parent of the node at the given index. */
  getParentIndex_(index) {
    return (index - 1) >> 1
  }

  /** Gets the values of the heap. */
  getValues() {
    const nodes = this.nodes_
    const rv = []
    const l = nodes.length
    for (var i = 0; i < l; i++) {
      rv.push(nodes[i].getValue())
    }
    return rv
  }

  /** Gets the keys of the heap.  */
  getKeys() {
    const nodes = this.nodes_
    const rv = []
    const l = nodes.length
    for (var i = 0; i < l; i++) {
      rv.push(nodes[i].getKey())
    }
    return rv
  }

  /** Whether the heap contains the given value. */
  containsValue(val) {
    return this.nodes_.some((node) => node.getValue() === val)
  }

  /** Whether the heap contains the given key. */
  containsKey(key) {
    return this.nodes_.some((node) => node.getKey() === key)
  }

  /** Clones a heap and returns a new heap. */
  clone() {
    return new Heap(this)
  }

  /** The number of key-value pairs in the map. */
  getCount() {
    return this.nodes_.length
  }

  /** Returns true if this heap contains no elements. */
  isEmpty() {
    return this.nodes_.length === 0
  }

  /** Removes all elements from the heap. */
  clear() {
    this.nodes_.length = 0
  }
}
