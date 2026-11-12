/**
 * Browser-safe check runner script injected into sandboxed preview iframes.
 * Separated from checkRunner.ts (which uses Node-only JSDOM) so Vite browser bundles stay clean.
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

    var runId = data.runId;
    var checks = data.checks || [];
    var results = [];

    for (var i = 0; i < checks.length; i++) {
      var check = checks[i];
      var checkResult = { id: check.id, passed: false, message: check.message };

      try {
        var timeoutPromise = new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error('Check timed out after 2000ms')); }, 2000);
        });

        var failReason = '';

        var execPromise = (async function() {
          var sel = check.selector;
          var exp = check.expected;
          var prop = check.property;

          function qsSafe(s) {
            if (!s) return null;
            var found = document.querySelector(s);
            if (found) return found;
            var alt = s.replace(/\\[(href|src)(\\s*=|\\])/g, '[data-ascent-orig-$1$2');
            return alt !== s ? document.querySelector(alt) : null;
          }
          function qsaSafe(s) {
            if (!s) return [];
            var list = document.querySelectorAll(s);
            if (list && list.length > 0) return list;
            var alt = s.replace(/\\[(href|src)(\\s*=|\\])/g, '[data-ascent-orig-$1$2');
            return alt !== s ? document.querySelectorAll(alt) : list;
          }

          switch(check.type) {
            case 'elementExists': {
              var el = qsSafe(sel);
              if (!el) failReason = 'Element "' + sel + '" not found in DOM.';
              return Boolean(el);
            }
            case 'elementCount': {
              var count = qsaSafe(sel).length;
              var target = parseInt(exp || '1', 10);
              if (count !== target) failReason = 'Expected ' + target + ' elements for "' + sel + '", found ' + count + '.';
              return count === target;
            }
            case 'textContains': {
              var el = qsSafe(sel);
              if (!el) { failReason = 'Element "' + sel + '" not found.'; return false; }
              var txt = (el.textContent || '').trim().toLowerCase();
              var needle = (exp || '').trim().toLowerCase();
              var ok = txt.indexOf(needle) !== -1;
              if (!ok) failReason = 'Expected "' + sel + '" text to contain "' + (exp || '') + '".';
              return ok;
            }
            case 'attributeEquals': {
              var el = qsSafe(sel);
              if (!el) { failReason = 'Element "' + sel + '" not found.'; return false; }
              var valuelessMatch = sel && sel.match(/\\[([a-zA-Z0-9_-]+)\\]/);
              var anyAttrMatch = sel && sel.match(/\\[([a-zA-Z0-9_-]+)/);
              var tag = (el.tagName || '').toLowerCase();
              var inferredAttr = valuelessMatch ? valuelessMatch[1] : ((tag === 'link' || tag === 'a' || (exp && String(exp).indexOf('.css') !== -1)) ? 'href' : ((tag === 'script' || tag === 'img') ? 'src' : (anyAttrMatch ? anyAttrMatch[1] : 'src')));
              var attrName = prop || inferredAttr;
              var origAttr = (attrName === 'src' || attrName === 'href') ? el.getAttribute('data-ascent-orig-' + attrName) : null;
              var attrActual = origAttr !== null ? origAttr : el.getAttribute(attrName);
              var ok = attrActual === exp;
              if (!ok) failReason = 'Expected attribute "' + attrName + '" on "' + sel + '" to equal "' + exp + '" (got "' + attrActual + '").';
              return ok;
            }
            case 'classContains': {
              var el = document.querySelector(sel);
              if (!el) { failReason = 'Element "' + sel + '" not found.'; return false; }
              var targetCls = (exp || prop || '').trim();
              var clsStr = typeof el.className === 'string' ? el.className : '';
              var ok = el.classList.contains(targetCls) || clsStr.split(/\\s+/).indexOf(targetCls) !== -1;
              if (!ok) failReason = 'Expected "' + sel + '" to have CSS class "' + targetCls + '".';
              return ok;
            }
            case 'styleEquals': {
              var el = document.querySelector(sel);
              if (!el) { failReason = 'Element "' + sel + '" not found.'; return false; }
              var p = prop || 'color';
              var kebabP = p.indexOf('-') !== -1 ? p : p.replace(/[A-Z]/g, function(m) { return '-' + m.toLowerCase(); });
              var inline = el.style ? (el.style[p] || el.style.getPropertyValue(kebabP)) : '';
              var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
              var comp = cs ? (cs.getPropertyValue(kebabP) || cs.getPropertyValue(p) || cs[p] || '') : '';
              var actual = String(inline || comp || '').toLowerCase();
              var ok = actual.indexOf((exp || '').toLowerCase()) !== -1;
              if (!ok) failReason = 'Expected style "' + p + '" on "' + sel + '" to match "' + (exp || '') + '" (got "' + actual + '").';
              return ok;
            }
            case 'scriptDefines': {
              var target = (exp || prop || '').trim();
              if (!target) { failReason = 'Missing symbol name for scriptDefines.'; return false; }
              if (typeof window[target] !== 'undefined') return true;
              if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(target)) {
                try {
                  if ((0, eval)('typeof ' + target) !== 'undefined') return true;
                } catch (evalErr) {}
              }
              var scriptNodes = document.querySelectorAll('script[data-ascent-source], #ascent-student-script');
              var scriptTxt = '';
              for (var si = 0; si < scriptNodes.length; si++) {
                scriptTxt += '\\n' + (scriptNodes[si].textContent || '');
              }
              if (scriptTxt) {
                var escaped = target.replace(/[.*+?^$(){}|[\\]\\\\]/g, '\\\\$&');
                var declRe = new RegExp('(?:function\\\\s+' + escaped + '\\\\b|(?:const|let|var|class)\\\\s+' + escaped + '\\\\b|window\\\\.' + escaped + '\\\\s*=)');
                if (declRe.test(scriptTxt)) return true;
              }
              failReason = 'Expected JavaScript to define "' + target + '".';
              return false;
            }
            case 'eventResult': {
              var act = check.action;
              var actObj = null;
              if (act && typeof act === 'object') {
                actObj = act;
              } else if (typeof act === 'string') {
                var trimmed = act.trim();
                var inMatch = trimmed.match(/^(input|change)\\s+([^\\s=]+)(?:\\s*=\\s*|\\s+)(.*)$/i);
                var simMatch = trimmed.match(/^(click|submit|focus|blur|input|change)\\s+(.+)$/i);
                if (inMatch) {
                  actObj = { type: inMatch[1].toLowerCase(), selector: inMatch[2], value: inMatch[3] };
                } else if (simMatch) {
                  actObj = { type: simMatch[1].toLowerCase(), selector: simMatch[2].trim() };
                } else {
                  actObj = { type: trimmed.toLowerCase(), selector: sel || 'button' };
                }
              }

              if (actObj && actObj.selector) {
                var triggerEl = document.querySelector(actObj.selector);
                if (!triggerEl) {
                  failReason = 'Trigger element "' + actObj.selector + '" not found.';
                  return false;
                }
                var actType = (actObj.type || 'click').toLowerCase();
                if (actType === 'click') {
                  triggerEl.click();
                } else if (actType === 'input' || actType === 'change') {
                  if ('value' in triggerEl && actObj.value !== undefined) {
                    triggerEl.value = actObj.value;
                  }
                  triggerEl.dispatchEvent(new Event('input', { bubbles: true }));
                  triggerEl.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (actType === 'submit') {
                  triggerEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                } else {
                  triggerEl.dispatchEvent(new Event(actType, { bubbles: true, cancelable: true }));
                }
                await new Promise(function(r) { setTimeout(r, 60); });
              }

              if (sel) {
                var targetEl = document.querySelector(sel);
                if (!targetEl) {
                  failReason = 'Target element "' + sel + '" not found after event.';
                  return false;
                }
                if (prop && exp !== undefined) {
                  if (prop === 'class' || prop === 'className') {
                    var clsTxt = typeof targetEl.className === 'string' ? targetEl.className : '';
                    var clsOk = targetEl.classList.contains(exp) || clsTxt.split(/\\s+/).indexOf(exp) !== -1;
                    if (!clsOk) failReason = 'Expected "' + sel + '" to have class "' + exp + '" after event.';
                    return clsOk;
                  }
                  if (prop === 'text' || prop === 'textContent') {
                    var tActual = targetEl.textContent || '';
                    var tOk = tActual.toLowerCase().indexOf(exp.toLowerCase()) !== -1;
                    if (!tOk) failReason = 'Expected "' + sel + '" text to contain "' + exp + '" after event.';
                    return tOk;
                  }
                  if (prop === 'value') {
                    var vActual = String(targetEl.value !== undefined ? targetEl.value : (targetEl.getAttribute('value') || ''));
                    var vOk = vActual === exp || vActual.toLowerCase().indexOf(exp.toLowerCase()) !== -1;
                    if (!vOk) failReason = 'Expected "' + sel + '" value to be "' + exp + '" after event.';
                    return vOk;
                  }
                  var aVal = targetEl.getAttribute(prop);
                  if (aVal !== null) {
                    var aOk = aVal === exp;
                    if (!aOk) failReason = 'Expected attribute "' + prop + '"="' + exp + '" on "' + sel + '" after event (got "' + aVal + '").';
                    return aOk;
                  }
                  var sVal = (window.getComputedStyle ? window.getComputedStyle(targetEl).getPropertyValue(prop) : '') || (targetEl.style ? targetEl.style.getPropertyValue(prop) : '') || '';
                  var pActual = sVal || (targetEl[prop] !== undefined ? String(targetEl[prop]) : '');
                  var pOk = pActual.toLowerCase() === exp.toLowerCase();
                  if (!pOk) failReason = 'Expected "' + prop + '"="' + exp + '" on "' + sel + '" after event.';
                  return pOk;
                }
                if (exp) {
                  var content = (targetEl.textContent || '') + ' ' + String(targetEl.value !== undefined ? targetEl.value : (targetEl.getAttribute('value') || ''));
                  var cOk = content.toLowerCase().indexOf(exp.toLowerCase()) !== -1;
                  if (!cOk) failReason = 'Expected "' + exp + '" after event on "' + sel + '".';
                  return cOk;
                }
              }
              return true;
            }
            case 'imageLoaded': {
              if (!sel) { failReason = 'Missing selector for imageLoaded.'; return false; }
              var img = qsSafe(sel);
              if (!img) { failReason = 'Image element "' + sel + '" not found.'; return false; }
              if ((img.tagName || '').toUpperCase() !== 'IMG') {
                failReason = 'Element "' + sel + '" is not an <img> element.';
                return false;
              }
              if (!img.complete) {
                await new Promise(function(resolve) {
                  var done = false;
                  var finish = function() {
                    if (done) return;
                    done = true;
                    resolve();
                  };
                  img.addEventListener('load', finish, { once: true });
                  img.addEventListener('error', finish, { once: true });
                  setTimeout(finish, 1500);
                });
              }
              var imgOk = Boolean(img.complete && img.naturalWidth > 0);
              if (!imgOk) {
                var origSrc = img.getAttribute('data-ascent-orig-src') || img.getAttribute('src') || '';
                failReason = 'Image "' + sel + '" failed to load' + (origSrc ? ' (src="' + origSrc + '")' : '') + '.';
              }
              return imgOk;
            }
            case 'assetExists': {
              var rawPath = String(check.path || exp || prop || sel || '').trim();
              if (!rawPath) { failReason = 'Missing file path for assetExists.'; return false; }
              var normTarget = rawPath.replace(/\\\\/g, '/').replace(/^\\.\\//, '').replace(/^\\/+/, '');
              var known = Array.isArray(window.__ascentProjectFiles) ? window.__ascentProjectFiles : [];
              var exists = known.indexOf(normTarget) !== -1 || known.some(function(p) {
                return String(p).replace(/\\\\/g, '/').replace(/^\\.\\//, '').replace(/^\\/+/, '') === normTarget;
              });
              if (!exists) failReason = 'Project asset "' + normTarget + '" not found.';
              return exists;
            }
            default:
              failReason = 'Unknown check type: ' + check.type;
              return false;
          }
        })();

        var passed = await Promise.race([execPromise, timeoutPromise]);
        checkResult.passed = Boolean(passed);
        if (!checkResult.passed && !checkResult.message) {
          checkResult.message = failReason || check.description || 'Check assertion failed';
        }
      } catch (err) {
        checkResult.passed = false;
        checkResult.message = err.message || 'Execution error during check';
      }

      results.push(checkResult);
    }

    window.parent.postMessage({ type: 'CHECKS_RESULT', runId: runId, results: results }, '*');
  });

  // Ready signal
  window.parent.postMessage({ type: 'PREVIEW_READY' }, '*');
})();
`
}

