/**
 * OSK — MU/TH/UR themed on-screen keyboard for the AlienPi launcher.
 *
 * Attaches to any input focused inside the launcher. Emits themed key-click
 * SFX. This is the *launcher* keyboard; inside FoundryVTT the fully-themed
 * squeekboard handles typing.
 */
(function () {
  const ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '-'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', ':'],
  ];

  let target = null;
  let shift = false;
  const el = () => document.getElementById('osk');

  function render() {
    const osk = el();
    osk.innerHTML = '';

    ROWS.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'osk-row';
      row.forEach((k) => {
        const key = document.createElement('button');
        key.className = 'key';
        key.textContent = shift ? k.toUpperCase() : k;
        key.dataset.key = k;
        rowEl.appendChild(key);
      });
      osk.appendChild(rowEl);
    });

    // Action row
    const actions = document.createElement('div');
    actions.className = 'osk-row';
    actions.appendChild(makeKey('⇧ SHIFT', 'key key--wide key--action', 'shift'));
    actions.appendChild(makeKey('SPACE', 'key key--space', 'space'));
    actions.appendChild(makeKey('⌫ DEL', 'key key--wide key--action', 'backspace'));
    actions.appendChild(makeKey('✓ DONE', 'key key--wide key--action', 'done'));
    osk.appendChild(actions);
  }

  function makeKey(label, cls, action) {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    b.dataset.action = action;
    return b;
  }

  function insert(text) {
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    target.value = target.value.slice(0, start) + text + target.value.slice(end);
    const pos = start + text.length;
    target.setSelectionRange(pos, pos);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function backspace() {
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    if (start === end && start > 0) {
      target.value = target.value.slice(0, start - 1) + target.value.slice(end);
      target.setSelectionRange(start - 1, start - 1);
    } else {
      target.value = target.value.slice(0, start) + target.value.slice(end);
      target.setSelectionRange(start, start);
    }
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function open(input) {
    target = input;
    render();
    el().classList.add('is-open');
    el().setAttribute('aria-hidden', 'false');
    window.SFX?.play('screenChange');
  }

  function close() {
    el().classList.remove('is-open');
    el().setAttribute('aria-hidden', 'true');
    target = null;
  }

  function handleKey(btn) {
    window.SFX?.play('key');
    const action = btn.dataset.action;
    if (action) {
      switch (action) {
        case 'shift':
          shift = !shift;
          render();
          break;
        case 'space':
          insert(' ');
          break;
        case 'backspace':
          backspace();
          break;
        case 'done':
          close();
          break;
      }
      return;
    }
    const k = btn.dataset.key;
    if (k) insert(shift ? k.toUpperCase() : k);
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Open OSK when a launcher input is focused.
    document.addEventListener('focusin', (e) => {
      if (e.target.matches('.field-input')) open(e.target);
    });

    // Key presses (delegated).
    el().addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.key');
      if (!btn) return;
      e.preventDefault();
      btn.classList.add('is-pressed');
      handleKey(btn);
      setTimeout(() => btn.classList.remove('is-pressed'), 90);
    });
  });

  window.OSK = { open, close };
})();
