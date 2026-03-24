(function () {
  'use strict';

  var CoalCheckout = {
    _container: null,
    _iframe: null,
    _listeners: {},
    _messageHandler: null,
    _options: {},

    /**
     * Mount the Coal checkout widget inside a container element.
     *
     * @param {string|Element} container - CSS selector or DOM element
     * @param {Object} options
     * @param {string}   options.sessionId  - Required. The checkout session ID.
     * @param {string}  [options.baseUrl]   - Base URL for the embed page. Defaults to https://usecoal.xyz
     * @param {number|string} [options.height] - iframe height. Defaults to 600.
     * @param {Function} [options.onSuccess] - Fired with { sessionId, txHash } when payment is confirmed.
     * @param {Function} [options.onError]   - Fired with { message } when an error occurs.
     * @param {Function} [options.onCancel]  - Fired when the user dismisses the widget.
     * @param {Function} [options.onReady]   - Fired when the iframe is loaded and ready.
     * @param {string}  [options.theme]      - 'light' | 'dark' (passed as query param)
     * @returns {CoalCheckout}
     */
    mount: function (container, options) {
      if (this._iframe) {
        this.unmount();
      }

      options = options || {};
      this._options = options;
      this._listeners = {};

      // Resolve container element
      if (typeof container === 'string') {
        this._container = document.querySelector(container);
        if (!this._container) {
          console.error('[CoalCheckout] Container not found: ' + container);
          return this;
        }
      } else if (container instanceof Element) {
        this._container = container;
      } else {
        console.error('[CoalCheckout] mount() requires a CSS selector string or DOM Element.');
        return this;
      }

      if (!options.sessionId) {
        console.error('[CoalCheckout] options.sessionId is required.');
        return this;
      }

      var baseUrl = options.baseUrl || 'https://usecoal.xyz';
      var height = options.height != null ? options.height : 600;
      var heightStr = typeof height === 'number' ? height + 'px' : height;

      // Build embed URL
      var embedUrl = baseUrl + '/embed/' + encodeURIComponent(options.sessionId);
      if (options.theme) {
        embedUrl += '?theme=' + encodeURIComponent(options.theme);
      }

      // Register option callbacks as event listeners
      if (typeof options.onSuccess === 'function') {
        this.on('success', options.onSuccess);
      }
      if (typeof options.onError === 'function') {
        this.on('error', options.onError);
      }
      if (typeof options.onCancel === 'function') {
        this.on('cancel', options.onCancel);
      }
      if (typeof options.onReady === 'function') {
        this.on('ready', options.onReady);
      }

      // Create iframe
      var iframe = document.createElement('iframe');
      iframe.src = embedUrl;
      iframe.style.width = '100%';
      iframe.style.height = heightStr;
      iframe.style.border = 'none';
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'payment camera');
      iframe.setAttribute('allowtransparency', 'true');

      this._iframe = iframe;
      this._container.appendChild(iframe);

      // Bind and register postMessage listener
      var self = this;
      this._messageHandler = function (event) {
        self._handleMessage(event);
      };
      window.addEventListener('message', this._messageHandler);

      return this;
    },

    /**
     * Remove the iframe and clean up all listeners.
     */
    unmount: function () {
      if (this._messageHandler) {
        window.removeEventListener('message', this._messageHandler);
        this._messageHandler = null;
      }
      if (this._iframe && this._iframe.parentNode) {
        this._iframe.parentNode.removeChild(this._iframe);
      }
      this._iframe = null;
      this._container = null;
      this._listeners = {};
      this._options = {};
    },

    /**
     * Register an event listener.
     *
     * @param {'ready'|'success'|'error'|'cancel'} event
     * @param {Function} callback
     * @returns {CoalCheckout}
     */
    on: function (event, callback) {
      if (typeof callback !== 'function') return this;
      if (!this._listeners[event]) {
        this._listeners[event] = [];
      }
      this._listeners[event].push(callback);
      return this;
    },

    /**
     * Remove a previously registered event listener.
     *
     * @param {'ready'|'success'|'error'|'cancel'} event
     * @param {Function} callback
     * @returns {CoalCheckout}
     */
    off: function (event, callback) {
      if (!this._listeners[event]) return this;
      this._listeners[event] = this._listeners[event].filter(function (fn) {
        return fn !== callback;
      });
      return this;
    },

    /**
     * @private
     * Dispatch an event to all registered listeners.
     */
    _emit: function (event, data) {
      var handlers = this._listeners[event];
      if (!handlers || handlers.length === 0) return;
      for (var i = 0; i < handlers.length; i++) {
        try {
          handlers[i](data);
        } catch (e) {
          console.error('[CoalCheckout] Error in ' + event + ' handler:', e);
        }
      }
    },

    /**
     * @private
     * Handle incoming postMessage events from the Coal iframe.
     *
     * The embed page fires:
     *   { type: 'coal:ready' }
     *   { type: 'coal:success', sessionId, txHash }
     *   { type: 'coal:error', message }  or  { type: 'coal:error', error }
     *   { type: 'coal:cancel' }
     *   { type: 'coal:close' }  — treated as cancel
     */
    _handleMessage: function (event) {
      // Only process messages from the expected iframe origin when possible.
      // We allow '*' here because callers can set a custom baseUrl (localhost, etc.).
      // In production the baseUrl is 'https://usecoal.xyz'.
      var expectedOrigin = this._options.baseUrl || 'https://usecoal.xyz';
      if (
        event.origin !== expectedOrigin &&
        event.origin !== window.location.origin
      ) {
        // Allow same-origin for local dev; otherwise bail.
        if (
          expectedOrigin !== 'https://usecoal.xyz' ||
          event.origin !== 'https://usecoal.xyz'
        ) {
          // For custom baseUrl, only accept that origin.
          if (event.origin !== expectedOrigin) return;
        }
      }

      var msg = event.data;
      if (!msg || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case 'coal:ready':
          this._emit('ready', { sessionId: msg.sessionId });
          break;

        case 'coal:success':
          this._emit('success', {
            sessionId: msg.sessionId,
            txHash: msg.txHash || null,
          });
          break;

        case 'coal:error':
          this._emit('error', {
            message: msg.message || msg.error || 'An error occurred.',
          });
          break;

        case 'coal:cancel':
        case 'coal:close':
          this._emit('cancel', { sessionId: msg.sessionId });
          break;

        default:
          break;
      }
    },
  };

  window.CoalCheckout = CoalCheckout;
  window.Coal = CoalCheckout;
})();
