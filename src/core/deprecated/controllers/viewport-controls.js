// Copyright (c) 2015 Uber Technologies, Inc.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import MapState from './map-state';
import LinearInterpolator from '../../transitions/linear-interpolator';
import {TRANSITION_EVENTS} from '../../lib/transition-manager';
import assert from 'assert';

const NO_TRANSITION_PROPS = {
  transitionDuration: 0
};
const LINEAR_TRANSITION_PROPS = {
  transitionDuration: 300,
  transitionEasing: t => t,
  transitionInterpolator: new LinearInterpolator(),
  transitionInterruption: TRANSITION_EVENTS.BREAK
};

// EVENT HANDLING PARAMETERS
const PITCH_MOUSE_THRESHOLD = 5;
const PITCH_ACCEL = 1.2;
const ZOOM_ACCEL = 0.01;

const EVENT_TYPES = {
  WHEEL: ['wheel'],
  PAN: ['panstart', 'panmove', 'panend'],
  PINCH: ['pinchstart', 'pinchmove', 'pinchend'],
  DOUBLE_TAP: ['doubletap'],
  KEYBOARD: ['keydown']
};

export default class ViewportControls {
  /**
   * @classdesc
   * A class that handles events and updates mercator style viewport parameters
   */
  constructor(ViewportState, options = {}) {
    assert(ViewportState);
    this.ViewportState = ViewportState;
    this.viewState = null;
    this.viewStateProps = null;
    this.eventManager = null;
    this._events = null;
    this._state = {
      isDragging: false
    };
    this.events = [];

    this.handleEvent = this.handleEvent.bind(this);

    this.setOptions(options);

    if (this.constructor === ViewportControls) {
      Object.seal(this);
    }
  }

  /**
   * Callback for events
   * @param {hammer.Event} event
   */
  handleEvent(event) {
    const {ViewportState} = this;
    this.viewState = new ViewportState(Object.assign({}, this.viewStateProps, this._state));

    switch (event.type) {
      case 'panstart':
        return this._onPanStart(event);
      case 'panmove':
        return this._onPan(event);
      case 'panend':
        return this._onPanEnd(event);
      case 'pinchstart':
        return this._onPinchStart(event);
      case 'pinchmove':
        return this._onPinch(event);
      case 'pinchend':
        return this._onPinchEnd(event);
      case 'doubletap':
        return this._onDoubleTap(event);
      case 'wheel':
        return this._onWheel(event);
      case 'keydown':
        return this._onKeyDown(event);
      default:
        return false;
    }
  }

  /* Event utils */
  // Event object: http://hammerjs.github.io/api/#event-object
  getCenter(event) {
    const {offsetCenter: {x, y}} = event;
    return [x, y];
  }

  isFunctionKeyPressed(event) {
    const {srcEvent} = event;
    return Boolean(srcEvent.metaKey || srcEvent.altKey || srcEvent.ctrlKey || srcEvent.shiftKey);
  }

  isDragging() {
    return this._state.isDragging;
  }

  /**
   * Extract interactivity options
   */
  setOptions(options) {
    const {
      onViewportChange,
      onStateChange = this.onStateChange,
      eventManager = this.eventManager,
      scrollZoom = true,
      dragPan = true,
      dragRotate = true,
      doubleClickZoom = true,
      touchZoom = true,
      touchRotate = false,
      keyboard = true
    } = options;

    this.onViewportChange = onViewportChange;
    this.onStateChange = onStateChange;
    this.viewStateProps = options;

    if (this.eventManager !== eventManager) {
      // EventManager has changed
      this.eventManager = eventManager;
      this._events = {};
      this.toggleEvents(this.events, true);
    }

    // Register/unregister events
    const isInteractive = Boolean(this.onViewportChange);
    this.toggleEvents(EVENT_TYPES.WHEEL, isInteractive && scrollZoom);
    this.toggleEvents(EVENT_TYPES.PAN, isInteractive && (dragPan || dragRotate));
    this.toggleEvents(EVENT_TYPES.PINCH, isInteractive && (touchZoom || touchRotate));
    this.toggleEvents(EVENT_TYPES.DOUBLE_TAP, isInteractive && doubleClickZoom);
    this.toggleEvents(EVENT_TYPES.KEYBOARD, isInteractive && keyboard);

    // Interaction toggles
    this.scrollZoom = scrollZoom;
    this.dragPan = dragPan;
    this.dragRotate = dragRotate;
    this.doubleClickZoom = doubleClickZoom;
    this.touchZoom = touchZoom;
    this.touchRotate = touchRotate;
    this.keyboard = keyboard;
  }

  toggleEvents(eventNames, enabled) {
    if (this.eventManager) {
      eventNames.forEach(eventName => {
        if (this._events[eventName] !== enabled) {
          this._events[eventName] = enabled;
          if (enabled) {
            this.eventManager.on(eventName, this.handleEvent);
          } else {
            this.eventManager.off(eventName, this.handleEvent);
          }
        }
      });
    }
  }

  // Private Methods

  setState(newState) {
    Object.assign(this._state, newState);
    if (this.onStateChange) {
      this.onStateChange(this._state);
    }
  }

  /* Callback util */
  // formats map state and invokes callback function
  updateViewport(newViewportState, extraProps = {}, extraState = {}) {
    const oldViewport = this.viewState.getViewportProps();
    const newViewport = Object.assign({}, newViewportState.getViewportProps(), extraProps);

    if (
      this.onViewportChange &&
      Object.keys(newViewport).some(key => oldViewport[key] !== newViewport[key])
    ) {
      // Viewport has changed
      const viewport = this.viewState.getViewport ? this.viewState.getViewport() : null;
      this.onViewportChange(newViewport, viewport);
    }

    this.setState(Object.assign({}, newViewportState.getInteractiveState(), extraState));
  }

  /* Event handlers */
  // Default handler for the `panstart` event.
  _onPanStart(event) {
    const pos = this.getCenter(event);
    const newViewportState = this.viewState.panStart({pos}).rotateStart({pos});
    return this.updateViewport(newViewportState, NO_TRANSITION_PROPS, {isDragging: true});
  }

  // Default handler for the `panmove` event.
  _onPan(event) {
    return this.isFunctionKeyPressed(event) || event.rightButton
      ? this._onPanRotate(event)
      : this._onPanMove(event);
  }

  // Default handler for the `panend` event.
  _onPanEnd(event) {
    const newViewportState = this.viewState.panEnd().rotateEnd();
    return this.updateViewport(newViewportState, null, {isDragging: false});
  }

  // Default handler for panning to move.
  // Called by `_onPan` when panning without function key pressed.
  _onPanMove(event) {
    if (!this.dragPan) {
      return false;
    }
    const pos = this.getCenter(event);
    const newViewportState = this.viewState.pan({pos});
    return this.updateViewport(newViewportState, NO_TRANSITION_PROPS, {isDragging: true});
  }

  // Default handler for panning to rotate.
  // Called by `_onPan` when panning with function key pressed.
  _onPanRotate(event) {
    if (!this.dragRotate) {
      return false;
    }

    return this.viewState instanceof MapState
      ? this._onPanRotateMap(event)
      : this._onPanRotateStandard(event);
  }

  // Normal pan to rotate
  _onPanRotateStandard(event) {
    const {deltaX, deltaY} = event;
    const {width, height} = this.viewState.getViewportProps();

    const deltaScaleX = deltaX / width;
    const deltaScaleY = deltaY / height;

    const newViewportState = this.viewState.rotate({deltaScaleX, deltaScaleY});
    return this.updateViewport(newViewportState, NO_TRANSITION_PROPS, {isDragging: true});
  }

  _onPanRotateMap(event) {
    const {deltaX, deltaY} = event;
    const [, centerY] = this.getCenter(event);
    const startY = centerY - deltaY;
    const {width, height} = this.viewState.getViewportProps();

    const deltaScaleX = deltaX / width;
    let deltaScaleY = 0;

    if (deltaY > 0) {
      if (Math.abs(height - startY) > PITCH_MOUSE_THRESHOLD) {
        // Move from 0 to -1 as we drag upwards
        deltaScaleY = deltaY / (startY - height) * PITCH_ACCEL;
      }
    } else if (deltaY < 0) {
      if (startY > PITCH_MOUSE_THRESHOLD) {
        // Move from 0 to 1 as we drag upwards
        deltaScaleY = 1 - centerY / startY;
      }
    }
    deltaScaleY = Math.min(1, Math.max(-1, deltaScaleY));

    const newViewportState = this.viewState.rotate({deltaScaleX, deltaScaleY});
    return this.updateViewport(newViewportState, NO_TRANSITION_PROPS, {isDragging: true});
  }

  // Default handler for the `wheel` event.
  _onWheel(event) {
    if (!this.scrollZoom) {
      return false;
    }

    const pos = this.getCenter(event);
    const {delta} = event;

    // Map wheel delta to relative scale
    let scale = 2 / (1 + Math.exp(-Math.abs(delta * ZOOM_ACCEL)));
    if (delta < 0 && scale !== 0) {
      scale = 1 / scale;
    }

    const newViewportState = this.viewState.zoom({pos, scale});
    return this.updateViewport(newViewportState, NO_TRANSITION_PROPS);
  }

  // Default handler for the `pinchstart` event.
  _onPinchStart(event) {
    const pos = this.getCenter(event);
    const newViewportState = this.viewState.zoomStart({pos}).rotateStart({pos});
    // hack - hammer's `rotation` field doesn't seem to produce the correct angle
    this._state.startPinchRotation = event.rotation;
    return this.updateViewport(newViewportState, NO_TRANSITION_PROPS, {isDragging: true});
  }

  // Default handler for the `pinch` event.
  _onPinch(event) {
    if (!this.touchZoom && !this.touchRotate) {
      return false;
    }

    let newViewportState = this.viewState;
    if (this.touchZoom) {
      const {scale} = event;
      const pos = this.getCenter(event);
      newViewportState = newViewportState.zoom({pos, scale});
    }
    if (this.touchRotate) {
      const {rotation} = event;
      const {startPinchRotation} = this._state;
      newViewportState = newViewportState.rotate({
        deltaScaleX: -(rotation - startPinchRotation) / 180
      });
    }

    return this.updateViewport(newViewportState, NO_TRANSITION_PROPS, {isDragging: true});
  }

  // Default handler for the `pinchend` event.
  _onPinchEnd(event) {
    const newViewportState = this.viewState.zoomEnd().rotateEnd();
    this._state.startPinchRotation = 0;
    return this.updateViewport(newViewportState, null, {isDragging: false});
  }

  // Default handler for the `doubletap` event.
  _onDoubleTap(event) {
    if (!this.doubleClickZoom) {
      return false;
    }
    const pos = this.getCenter(event);
    const isZoomOut = this.isFunctionKeyPressed(event);

    const newViewportState = this.viewState.zoom({pos, scale: isZoomOut ? 0.5 : 2});
    return this.updateViewport(newViewportState, LINEAR_TRANSITION_PROPS);
  }

  /* eslint-disable complexity */
  // Default handler for the `keydown` event
  _onKeyDown(event) {
    if (!this.keyboard) {
      return false;
    }
    const funcKey = this.isFunctionKeyPressed(event);
    const {viewState} = this;
    let newViewportState;

    switch (event.srcEvent.keyCode) {
      case 189: // -
        newViewportState = funcKey ? viewState.zoomOut().zoomOut() : viewState.zoomOut();
        break;
      case 187: // +
        newViewportState = funcKey ? viewState.zoomIn().zoomIn() : viewState.zoomIn();
        break;
      case 37: // left
        newViewportState = funcKey ? viewState.rotateLeft() : viewState.moveLeft();
        break;
      case 39: // right
        newViewportState = funcKey ? viewState.rotateRight() : viewState.moveRight();
        break;
      case 38: // up
        newViewportState = funcKey ? viewState.rotateUp() : viewState.moveUp();
        break;
      case 40: // down
        newViewportState = funcKey ? viewState.rotateDown() : viewState.moveDown();
        break;
      default:
        return false;
    }
    return this.updateViewport(newViewportState, LINEAR_TRANSITION_PROPS);
  }
  /* eslint-enable complexity */
}
