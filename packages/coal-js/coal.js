(function (global) {
  'use strict';

  var DEFAULT_BASE_URL = 'https://usecoal.xyz';
  var DEFAULT_API_URL = 'https://api.usecoal.xyz';

  var CoalCheckout = {
    _container: null,
    _iframe: null,
    _overlay: null,
    _listeners: {},
    _messageHandler: null,
    _options: {},
    _cleanupHandlers: null,

    mount: function (container, options) {
      if (this._iframe) {
        this.unmount();
      }

      options = options || {};
      this._options = options;
      this._listeners = {};

      if (typeof container === 'string') {
        this._container = global.document.querySelector(container);
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

      this._bindCallbacks(options);
      this._insertIframe(options, this._container);
      this._attachMessageHandler(options.baseUrl || DEFAULT_BASE_URL);

      return this;
    },

    checkout: function (options) {
      options = options || {};
      var self = this;
      var apiUrl = options.apiUrl || DEFAULT_API_URL;

      if (!options.apiKey) {
        console.error('[CoalCheckout] options.apiKey is required for checkout().');
        return this;
      }

      if (typeof global.fetch !== 'function') {
        console.error('[CoalCheckout] fetch() is required for checkout().');
        return this;
      }

      global
        .fetch(apiUrl + '/api/widget/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': options.apiKey,
          },
          body: JSON.stringify({
            amount: options.amount,
            currency: options.currency,
            description: options.description,
            // Optional payer info collection config, e.g.
            // { required: true, fields: ['fullName', 'email'] }
            payerInfo: options.payerInfo,
          }),
        })
        .then(function (response) {
          return response.json().then(function (data) {
            return {
              ok: response.ok,
              data: data || {},
            };
          });
        })
        .then(function (result) {
          if (!result.ok || !result.data.sessionId) {
            throw new Error(result.data.error || result.data.message || 'Failed to create session');
          }

          var overlay = global.document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px;';

          var frameShell = global.document.createElement('div');
          frameShell.style.cssText = 'width:min(420px,95vw);height:min(560px,92vh);border-radius:24px;overflow:hidden;background:#fff;box-shadow:0 24px 60px rgba(17, 12, 46, 0.22);';
          overlay.appendChild(frameShell);
          (global.document.body || global.document.documentElement).appendChild(overlay);

          var cleanup = self._createOverlayCleanup(overlay);
          var wrappedOptions = self._wrapLegacyCallbacks(options, cleanup);
          wrappedOptions.sessionId = result.data.sessionId;
          wrappedOptions.height = wrappedOptions.height != null ? wrappedOptions.height : 560;
          wrappedOptions.baseUrl = wrappedOptions.baseUrl || DEFAULT_BASE_URL;

          self.mount(frameShell, wrappedOptions);

          overlay.addEventListener('click', function (event) {
            if (event.target === overlay) {
              cleanup();
              self.unmount();
              if (typeof options.onClose === 'function') {
                options.onClose();
              }
            }
          });
        })
        .catch(function (error) {
          if (typeof options.onError === 'function') {
            options.onError(error && error.message ? error.message : 'Failed to create session');
          } else {
            console.error('[CoalCheckout] Failed to create session:', error);
          }
        });

      return this;
    },

    unmount: function () {
      if (this._messageHandler) {
        global.removeEventListener('message', this._messageHandler);
        this._messageHandler = null;
      }
      if (this._iframe && this._iframe.parentNode) {
        this._iframe.parentNode.removeChild(this._iframe);
      }
      this._iframe = null;
      this._container = null;
      this._listeners = {};
      this._options = {};
      this._cleanupHandlers = null;
    },

    on: function (event, callback) {
      if (typeof callback !== 'function') return this;
      if (!this._listeners[event]) {
        this._listeners[event] = [];
      }
      this._listeners[event].push(callback);
      return this;
    },

    off: function (event, callback) {
      if (!this._listeners[event]) return this;
      this._listeners[event] = this._listeners[event].filter(function (fn) {
        return fn !== callback;
      });
      return this;
    },

    _bindCallbacks: function (options) {
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
    },

    _insertIframe: function (options, container) {
      var baseUrl = options.baseUrl || DEFAULT_BASE_URL;
      var height = options.height != null ? options.height : 600;
      var heightStr = typeof height === 'number' ? height + 'px' : height;

      var embedUrl = baseUrl + '/embed/' + encodeURIComponent(options.sessionId);
      if (options.theme) {
        embedUrl += '?theme=' + encodeURIComponent(options.theme);
      }

      var iframe = global.document.createElement('iframe');
      iframe.src = embedUrl;
      iframe.style.width = '100%';
      iframe.style.height = heightStr;
      iframe.style.border = 'none';
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'payment camera');
      iframe.setAttribute('allowtransparency', 'true');
      iframe.title = 'Coal Checkout';

      container.appendChild(iframe);
      this._iframe = iframe;
    },

    _attachMessageHandler: function (baseUrl) {
      var expectedOrigin;
      try {
        expectedOrigin = new URL(baseUrl).origin;
      } catch (error) {
        expectedOrigin = baseUrl || DEFAULT_BASE_URL;
      }

      var self = this;
      this._messageHandler = function (event) {
        if (event.origin !== expectedOrigin && event.origin !== global.location.origin) {
          return;
        }

        self._handleMessage(event);
      };

      global.addEventListener('message', this._messageHandler);
    },

    _wrapLegacyCallbacks: function (options, cleanup) {
      var wrapped = {};
      var self = this;

      Object.keys(options).forEach(function (key) {
        if (key === 'onSuccess' || key === 'onError' || key === 'onCancel') {
          return;
        }
        wrapped[key] = options[key];
      });

      wrapped.onReady = options.onReady;
      wrapped.onSuccess = function (payload) {
        cleanup();
        self.unmount();
        if (typeof options.onSuccess === 'function') {
          options.onSuccess(payload);
        }
      };
      wrapped.onError = function (payload) {
        cleanup();
        self.unmount();
        if (typeof options.onError === 'function') {
          options.onError(payload);
        }
      };
      wrapped.onCancel = function (payload) {
        cleanup();
        self.unmount();
        if (typeof options.onClose === 'function') {
          options.onClose(payload);
        }
      };

      return wrapped;
    },

    _createOverlayCleanup: function (overlay) {
      var cleaned = false;
      return function () {
        if (cleaned) return;
        cleaned = true;
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      };
    },

    _emit: function (event, data) {
      var handlers = this._listeners[event];
      if (!handlers || handlers.length === 0) return;
      for (var i = 0; i < handlers.length; i++) {
        try {
          handlers[i](data);
        } catch (error) {
          console.error('[CoalCheckout] Error in ' + event + ' handler:', error);
        }
      }
    },

    _handleMessage: function (event) {
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

  global.CoalCheckout = CoalCheckout;
  global.Coal = CoalCheckout;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CoalCheckout;
  }
})(typeof window !== 'undefined' ? window : globalThis);
