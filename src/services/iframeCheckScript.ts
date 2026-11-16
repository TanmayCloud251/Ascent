/**
 * Returns the client-side JavaScript snippet to inject into the sandboxed preview iframe.
 * The script listens for postMessage `{ type: 'RUN_CHECKS', checks }`, executes them against
 * the iframe's DOM, and posts back `{ type: 'CHECKS_RESULT', results }`.
 */
export function getIframeCheckRunnerScript(): string {
  return `
(function() {
  // Capture console messages and runtime errors
  var originalLog = console.log;
  var originalWarn = console.warn;
  var originalError = console.error;

  function sendConsole(level, args) {
    try {
      var text = Array.from(args).map(function(a) {
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch(e) { return String(a); }
        }
        return String(a);
      }).join(' ');
      window.parent.postMessage({ type: 'CONSOLE_LOG', level: level, message: text }, '*');
    } catch(e) {}
  }

  console.log = function() { sendConsole('info', arguments); originalLog.apply(console, arguments); };
  console.warn = function() { sendConsole('warn', arguments); originalWarn.apply(console, arguments); };
  console.error = function() { sendConsole('error', arguments); originalError.apply(console, arguments); };

  window.addEventListener('error', function(event) {
    window.parent.postMessage({
      type: 'CONSOLE_LOG',
      level: 'error',
      message: (event.message || 'Error') + ' at line ' + (event.lineno || 0)
    }, '*');
  });

  // Listen for parent check runner requests
  window.addEventListener('message', async function(ev) {
    var data = ev.data;
    if (!data || data.type !== 'RUN_CHECKS') return;

    var checks = data.checks || [];
    var results = [];

    for (var i = 0; i < checks.length; i++) {
      var check = checks[i];
      var checkResult = { id: check.id, passed: false, message: check.message };

      try {
        var timeoutPromise = new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error('Check timed out after 2000ms')); }, 2000);
        });

        var execPromise = (async function() {
          var sel = check.selector;
          var exp = check.expected;
          var prop = check.property;

          switch(check.type) {
            case 'elementExists': {
              var el = document.querySelector(sel);
              return Boolean(el);
            }
            case 'elementCount': {
              var count = document.querySelectorAll(sel).length;
              var target = parseInt(exp || '1', 10);
              return count === target;
            }
            case 'textContains': {
              var el = document.querySelector(sel);
              if (!el) return false;
              var txt = (el.textContent || '').trim().toLowerCase();
              return txt.indexOf((exp || '').trim().toLowerCase()) !== -1;
            }
            case 'attributeEquals': {
              var el = document.querySelector(sel);
              if (!el) return false;
              var attrName = prop;
              if (!attrName) {
                var bareMatch = sel && sel.match(/\\[([a-zA-Z0-9_-]+)\\]/);
                if (bareMatch) {
                  attrName = bareMatch[1];
                } else {
                  var tag = el.tagName.toUpperCase();
                  if (tag === 'LINK' || tag === 'A') attrName = 'href';
                  else if (tag === 'IMG' || tag === 'SCRIPT' || tag === 'SOURCE') attrName = 'src';
                  else if (tag === 'META') attrName = 'content';
                  else if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'OPTION') attrName = 'value';
                  else attrName = (sel && sel.match(/\\[([a-zA-Z0-9_-]+)/)) ? sel.match(/\\[([a-zA-Z0-9_-]+)/)[1] : 'src';
                }
              }
              if (el.getAttribute(attrName) === exp) return true;
              if (!prop) {
                for (var aIdx = 0; aIdx < el.attributes.length; aIdx++) {
                  if (el.attributes[aIdx].value === exp) return true;
                }
              }
              return false;
            }
            case 'classContains': {
              var el = document.querySelector(sel);
              if (!el) return false;
              var targetCls = (exp || prop || '').trim();
              return el.classList.contains(targetCls) || el.className.indexOf(targetCls) !== -1;
            }
            case 'styleEquals': {
              var el = document.querySelector(sel);
              if (!el) return false;
              var p = prop || 'color';
              var inline = el.style ? el.style[p] : '';
              var comp = window.getComputedStyle ? window.getComputedStyle(el).getPropertyValue(p) : '';
              var actual = (inline || comp || '').toLowerCase();
              return actual.indexOf((exp || '').toLowerCase()) !== -1;
            }
            case 'scriptDefines': {
              var target = (exp || prop || '').trim();
              return Boolean(window[target]);
            }
            case 'eventResult': {
              var act = check.action;
              var triggerSel = (act && act.selector) || sel;
              var triggerEl = triggerSel ? document.querySelector(triggerSel) : null;
              if (triggerEl) {
                var actType = (act && act.type) || (typeof act === 'string' ? act : 'click');
                if (actType === 'click') {
                  triggerEl.click();
                } else if (actType === 'input') {
                  if ('value' in triggerEl && act && act.value !== undefined) {
                    triggerEl.value = act.value;
                  }
                  triggerEl.dispatchEvent(new Event('input', { bubbles: true }));
                  triggerEl.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (actType === 'submit') {
                  triggerEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
                await new Promise(function(r) { setTimeout(r, 60); });
              }

              if (sel && exp) {
                var targetEl = document.querySelector(sel);
                if (!targetEl) return false;
                var content = (targetEl.textContent || '') + ' ' + (targetEl.value || '');
                return content.toLowerCase().indexOf(exp.toLowerCase()) !== -1;
              }
              return true;
            }
            default:
              return false;
          }
        })();

        var passed = await Promise.race([execPromise, timeoutPromise]);
        checkResult.passed = Boolean(passed);
        if (!checkResult.passed && !checkResult.message) {
          checkResult.message = check.description || 'Check assertion failed';
        }
      } catch (err) {
        checkResult.passed = false;
        checkResult.message = err.message || 'Execution error during check';
      }

      results.push(checkResult);
    }

    window.parent.postMessage({ type: 'CHECKS_RESULT', results: results }, '*');
  });

  // Ready signal
  window.parent.postMessage({ type: 'PREVIEW_READY' }, '*');
})();
`
}
