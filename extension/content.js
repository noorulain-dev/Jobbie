// Jobby Content Script — Phase 5
// Injected on-demand. Returns DOM content, field inventory, or fills fields.

var MODE = typeof JOBBY_SCAN_MODE !== 'undefined' ? JOBBY_SCAN_MODE : 'detect';
var FILL_ANSWERS = typeof JOBBY_FILL_ANSWERS !== 'undefined' ? JOBBY_FILL_ANSWERS : null;

(function() {
  if (MODE === 'scan') return scanFormFields();
  if (MODE === 'fill' && FILL_ANSWERS) return fillFields(FILL_ANSWERS);
  return { url: window.location.href, html: document.documentElement.outerHTML, title: document.title };
})();

function scanFormFields() {
  var fields = [];
  var fieldId = 0;

  function getLabel(el) {
    if (el.id) { var lbl = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (lbl) return lbl.textContent.trim(); }
    var parent = el.closest('label'); if (parent) { var t = parent.textContent.trim(); if (t.length < 200) return t; }
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    var labelledBy = el.getAttribute('aria-labelledby'); if (labelledBy) { var ref = document.getElementById(labelledBy); if (ref) return ref.textContent.trim(); }
    if (el.placeholder) return el.placeholder.trim();
    if (el.name) return el.name.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    var prev = el.previousElementSibling;
    if (prev && (prev.tagName === 'SPAN' || prev.tagName === 'LABEL' || prev.tagName === 'DIV')) { var pt = prev.textContent.trim(); if (pt.length < 100) return pt; }
    return '';
  }

  function getControlType(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';
    if (tag !== 'input') return 'unknown';
    var type = (el.getAttribute('type') || 'text').toLowerCase();
    var map = { text:'text',email:'email',tel:'tel',number:'number',date:'date',url:'url',radio:'radio',checkbox:'checkbox',file:'file',hidden:'hidden',password:'password' };
    return map[type] || 'text';
  }

  function isSensitiveLabel(label) {
    return /password|credit card|card number|cvv|ssn|social security|government id|national id|passport number|bank account|routing number/i.test(label.toLowerCase());
  }

  function isDemographicLabel(label) {
    return /disability|veteran|race|ethnicity|gender identity|sexual orientation|religion|medical condition/i.test(label.toLowerCase());
  }

  function getNearbyHeading(el) {
    var current = el;
    for (var i = 0; i < 4; i++) { if (!current) break;
      var fs = current.closest('fieldset'); if (fs) { var legend = fs.querySelector('legend'); if (legend) return legend.textContent.trim(); }
      var prev = current.previousElementSibling;
      while (prev) { if (/^H[1-6]$/.test(prev.tagName)) return prev.textContent.trim(); prev = prev.previousElementSibling; }
      current = current.parentElement;
    } return '';
  }

  var elements = document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]), textarea, select');
  var seenRadios = {};

  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    if (el.type === 'hidden') continue;
    if (el.disabled) continue;
    if (el.readOnly && el.tagName === 'INPUT' && el.type !== 'text') continue;
    var rect = el.getBoundingClientRect();
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (el.type === 'file') continue;

    var label = getLabel(el);
    var options = [];

    if (el.type === 'radio') {
      var radioName = el.name || 'unnamed_radio';
      if (seenRadios[radioName]) continue;
      seenRadios[radioName] = true;
      var radios = document.querySelectorAll('input[type="radio"][name="' + CSS.escape(el.name) + '"]');
      radios.forEach(function(r) { var rl = getLabel(r); options.push({ label: rl || r.value, value: r.value }); });
    }
    if (el.tagName === 'SELECT') {
      for (var j = 0; j < el.options.length; j++) {
        var opt = el.options[j]; if (opt.value) options.push({ label: opt.textContent.trim() || opt.value, value: opt.value });
      }
    }
    if (el.type === 'checkbox') { options.push({ label: 'Yes', value: 'true' }); options.push({ label: 'No', value: 'false' }); }

    fields.push({
      runtimeId: 'field_' + (fieldId++),
      label: label,
      controlType: getControlType(el),
      required: el.required || el.getAttribute('aria-required') === 'true' || false,
      placeholder: (el.placeholder || '').substring(0, 200),
      existingValue: el.value || '',
      options: options.length > 0 ? options : undefined,
      maxLength: el.maxLength > 0 ? el.maxLength : undefined,
      minLength: el.minLength > 0 ? el.minLength : undefined,
      name: el.name || undefined,
      id: el.id || undefined,
      autocomplete: el.getAttribute('autocomplete') || undefined,
      nearbyHeading: getNearbyHeading(el),
      visible: rect.width > 0 && rect.height > 0,
      disabled: false,
      editable: !el.readOnly,
      sensitive: isSensitiveLabel(label),
      demographic: isDemographicLabel(label),
      formId: el.closest('form') ? (el.closest('form').id || el.closest('form').getAttribute('name') || null) : null
    });
  }

  return {
    url: window.location.href,
    title: document.title,
    fields: fields,
    formCount: document.querySelectorAll('form').length,
    scannedAt: new Date().toISOString()
  };
}
function fillFields(answers) {
  var fields = scanFormFields().fields;
  var results = [];
  var changed = [];

  for (var i = 0; i < answers.length; i++) {
    var ans = answers[i];
    if (!ans.value && ans.value !== '0') { results.push({ fieldId: ans.fieldId, status: 'NEEDS_USER_INPUT', reason: 'No value provided' }); continue; }
    var match = findMatchingField(fields, ans);
    if (!match) { results.push({ fieldId: ans.fieldId, status: 'FAILED', reason: 'Field not found on live page' }); continue; }
    if (match.existingValue && match.existingValue.trim() && match.existingValue.trim() !== ans.value) {
      results.push({ fieldId: ans.fieldId, status: 'SKIPPED', reason: 'Already populated', previousValue: match.existingValue }); continue;
    }
    if (match.existingValue && match.existingValue.trim() === ans.value) {
      results.push({ fieldId: ans.fieldId, status: 'SKIPPED', reason: 'Value already matches' }); continue;
    }
    var el = findElementByIndex(match.runtimeId);
    if (!el) { results.push({ fieldId: ans.fieldId, status: 'FAILED', reason: 'Element not found' }); continue; }
    if (el.disabled || el.readOnly) { results.push({ fieldId: ans.fieldId, status: 'SKIPPED', reason: 'Disabled or readonly' }); continue; }
    var prev = el.value || '';
    var ok = writeValue(el, match.controlType, ans.value);
    if (ok) { changed.push({ fieldId: ans.fieldId, previousValue: prev, newValue: ans.value }); results.push({ fieldId: ans.fieldId, status: 'FILLED', previousValue: prev, newValue: ans.value }); }
    else { results.push({ fieldId: ans.fieldId, status: 'FAILED', reason: 'Write not accepted by page' }); }
  }
  return { results: results, changed: changed, changedCount: changed.length, totalFields: fields.length, filledAt: new Date().toISOString() };
}

function findMatchingField(liveFields, answer) {
  for (var i = 0; i < liveFields.length; i++) {
    var f = liveFields[i];
    if (f.label === answer.label && f.controlType === answer.controlType) return f;
  }
  for (var i = 0; i < liveFields.length; i++) {
    var f = liveFields[i];
    if (f.label && answer.label && f.controlType === answer.controlType && (f.label.includes(answer.label) || answer.label.includes(f.label))) return f;
    if (answer.name && f.name === answer.name) return f;
    if (answer.id && f.id === answer.id) return f;
  }
  return null;
}

function findElementByIndex(runtimeId) {
  var idx = parseInt(runtimeId.replace('field_', ''), 10);
  if (isNaN(idx)) return null;
  var elements = document.querySelectorAll('input:not([type=\"submit\"]):not([type=\"button\"]):not([type=\"image\"]):not([type=\"reset\"]), textarea, select');
  var count = 0;
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    if (el.type === 'hidden' || el.disabled) continue;
    if (el.readOnly && el.tagName === 'INPUT' && el.type !== 'text') continue;
    if (el.type === 'file') continue;
    var st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    if (el.type === 'radio') { if (i > 0 && elements[i-1].name === el.name && elements[i-1].type === 'radio') continue; }
    if (count === idx) return el;
    count++;
  }
  return null;
}

function writeValue(el, controlType, value) {
  try {
    if (controlType === 'select') {
      var vl = value.toLowerCase();
      for (var j = 0; j < el.options.length; j++) {
        var o = el.options[j];
        if (o.value.toLowerCase() === vl || o.textContent.trim().toLowerCase() === vl) { el.value = o.value; fire(el, 'change'); return el.value === o.value; }
      }
      return false;
    }
    if (controlType === 'radio') {
      var radios = document.querySelectorAll('input[type=\"radio\"][name=\"' + CSS.escape(el.name) + '\"]');
      for (var k = 0; k < radios.length; k++) { if (radios[k].value.toLowerCase() === value.toLowerCase()) { radios[k].checked = true; fire(radios[k], 'change'); fire(radios[k], 'click'); return radios[k].checked; } }
      return false;
    }
    if (controlType === 'checkbox') {
      var ck = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
      if (el.checked !== ck) { el.checked = ck; fire(el, 'change'); }
      return el.checked === ck;
    }
    if (controlType === 'text' || controlType === 'email' || controlType === 'tel' || controlType === 'number' || controlType === 'url' || controlType === 'password' || controlType === 'textarea') {
      el.focus();
      var ns = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      if (ns && ns.set) { ns.set.call(el, value); } else { el.value = value; }
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      el.blur();
      return true;
    }
  } catch (e) { return false; }
}

function undoFields(changes) {
  // changes: [{ fieldId, previousValue, newValue }]
  var restored = 0;
  var skipped = 0;
  var failed = 0;
  var results = [];

  for (var i = 0; i < changes.length; i++) {
    var ch = changes[i];
    // Re-find the element
    var el = findElementByIndex(ch.fieldId);
    if (!el) { results.push({ fieldId: ch.fieldId, status: 'FAILED', reason: 'Element not found' }); failed++; continue; }
    if (el.disabled || el.readOnly) { results.push({ fieldId: ch.fieldId, status: 'SKIPPED', reason: 'Disabled or readonly' }); skipped++; continue; }

    // Verify the current value still matches what Jobby inserted
    var currentVal = el.value || '';
    if (currentVal !== ch.newValue) {
      results.push({ fieldId: ch.fieldId, status: 'SKIPPED', reason: 'User has modified the field since fill' });
      skipped++;
      continue;
    }

    // Restore previous value
    var ok = writeValue(el, el.type === 'select-one' ? 'select' : el.type === 'checkbox' ? 'checkbox' : el.type === 'radio' ? 'radio' : 'text', ch.previousValue || '');
    if (ok) {
      results.push({ fieldId: ch.fieldId, status: 'RESTORED', previousValue: ch.newValue, restoredValue: ch.previousValue });
      restored++;
    } else {
      results.push({ fieldId: ch.fieldId, status: 'FAILED', reason: 'Write not accepted' });
      failed++;
    }
  }

  return { results: results, restored: restored, skipped: skipped, failed: failed, undoneAt: new Date().toISOString() };
}
function fire(el, name) { el.dispatchEvent(new Event(name, { bubbles: true, cancelable: true })); }