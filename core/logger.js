// BBO Tools - Logger
// Provides centralized logging with different levels and contexts

(function(exports) {
  'use strict';

  const Logger = {
    // Log levels
    levels: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      NONE: 4
    },

    // Current log level
    _currentLevel: 1, // Default to INFO

    // Log prefix
    _prefix: 'BBOTools',

    // Context stack for nested logging
    _contextStack: [],

    // Initialize logger with options
    init(options = {}) {
      if (options.level !== undefined) {
        this.setLevel(options.level);
      }
      if (options.prefix !== undefined) {
        this._prefix = options.prefix;
      }
    },

    // Set current log level
    setLevel(level) {
      if (typeof level === 'string') {
        level = this.levels[level.toUpperCase()];
      }
      if (typeof level === 'number' && level >= 0 && level <= 4) {
        this._currentLevel = level;
      } else {
        console.warn(`Logger: Invalid log level "${level}"`);
      }
    },

    // Push a context onto the stack
    pushContext(context) {
      this._contextStack.push(context);
    },

    // Pop a context from the stack
    popContext() {
      return this._contextStack.pop();
    },

    // Create a new logger instance with a specific context
    createContextLogger(context) {
      const contextLogger = Object.create(this);
      contextLogger._contextStack = [context];
      return contextLogger;
    },

    // Format the log message with prefix and context
    _formatMessage(level, message, data) {
      const timestamp = new Date().toISOString();
      const levelStr = Object.keys(this.levels).find(key => this.levels[key] === level) || 'UNKNOWN';
      
      let formattedMessage = `[${timestamp}] ${this._prefix}`;
      
      if (this._contextStack.length > 0) {
        formattedMessage += ` [${this._contextStack.join(' > ')}]`;
      }
      
      formattedMessage += ` ${levelStr}: ${message}`;
      
      return { formattedMessage, data };
    },

    // Core logging method
    _log(level, message, data) {
      if (level < this._currentLevel) {
        return;
      }

      const { formattedMessage, data: logData } = this._formatMessage(level, message, data);

      switch (level) {
        case this.levels.DEBUG:
          if (logData !== undefined) {
            console.debug(formattedMessage, logData);
          } else {
            console.debug(formattedMessage);
          }
          break;
        case this.levels.INFO:
          if (logData !== undefined) {
            console.info(formattedMessage, logData);
          } else {
            console.info(formattedMessage);
          }
          break;
        case this.levels.WARN:
          if (logData !== undefined) {
            console.warn(formattedMessage, logData);
          } else {
            console.warn(formattedMessage);
          }
          break;
        case this.levels.ERROR:
          if (logData !== undefined) {
            console.error(formattedMessage, logData);
          } else {
            console.error(formattedMessage);
          }
          break;
      }

      // Emit log event for potential listeners
      this._emitLogEvent(level, message, data);
    },

    // Emit log event (can be extended for remote logging)
    _emitLogEvent(level, message, data) {
      // This could be extended to send logs to a remote server
      // or to trigger other logging mechanisms
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('bbotools:log', {
          detail: {
            level,
            message,
            data,
            timestamp: new Date().toISOString(),
            context: [...this._contextStack]
          }
        });
        window.dispatchEvent(event);
      }
    },

    // Convenience methods
    debug(message, data) {
      this._log(this.levels.DEBUG, message, data);
    },

    info(message, data) {
      this._log(this.levels.INFO, message, data);
    },

    warn(message, data) {
      this._log(this.levels.WARN, message, data);
    },

    error(message, data) {
      this._log(this.levels.ERROR, message, data);
    },

    // Group logging (similar to console.group)
    group(label) {
      console.group(`${this._prefix}: ${label}`);
      this.pushContext(label);
    },

    groupEnd() {
      console.groupEnd();
      this.popContext();
    },

    // Time measurement
    time(label) {
      console.time(`${this._prefix}: ${label}`);
    },

    timeEnd(label) {
      console.timeEnd(`${this._prefix}: ${label}`);
    },

    // Performance timing
    startTimer(label) {
      const startTime = performance.now();
      return {
        end: () => {
          const duration = performance.now() - startTime;
          this.debug(`${label} took ${duration.toFixed(2)}ms`);
          return duration;
        }
      };
    },

    // Table logging
    table(data, columns) {
      console.table(data, columns);
    },

    // Assert logging
    assert(condition, message, data) {
      if (!condition) {
        this.error(`Assertion failed: ${message}`, data);
      }
    },

    // Clear console (development only)
    clear() {
      if (this._currentLevel <= this.levels.DEBUG) {
        console.clear();
      }
    }
  };

  // Export for both module systems
  if (typeof window !== 'undefined' && window.BBOTools) {
    window.BBOTools.modules.Logger = Logger;
    console.log('BBOTools: Logger module registered');
  }
  
  // ES module export
  if (typeof exports !== 'undefined') {
    exports.Logger = Logger;
  }

})(typeof exports !== 'undefined' ? exports : {});