/* ==========================================================================
   DevToolsHub — Global JavaScript
   Loaded on every page. Keeps it lightweight: theme, nav, clipboard, toast,
   and shared utility helpers.
   ========================================================================== */

'use strict';

/* ==========================================================================
   §1  Theme Toggle
   Reads/writes localStorage key "devtoolshub-theme".
   Default: dark. Applies data-theme on <html>.
   ========================================================================== */

const THEME_KEY = 'devtoolshub-theme';
const THEME_DARK = 'dark';
const THEME_LIGHT = 'light';

/**
 * Returns the stored theme or falls back to dark.
 * Wrapped in try/catch for environments where localStorage is disabled.
 * @returns {'dark' | 'light'}
 */
function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === THEME_LIGHT || saved === THEME_DARK) {
      return saved;
    }
  } catch (_) {
    /* localStorage unavailable (e.g. Safari private mode) */
  }
  return THEME_DARK;
}

/**
 * Applies the given theme to the document and persists the choice.
 * @param {'dark' | 'light'} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (_) {
    /* localStorage unavailable — theme still applies, just won't persist */
  }

  /* Update every toggle button's aria-label for accessibility */
  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.setAttribute(
      'aria-label',
      theme === THEME_DARK ? 'Switch to light mode' : 'Switch to dark mode'
    );
  });
}

/**
 * Toggles between dark ↔ light and persists.
 */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === THEME_DARK ? THEME_LIGHT : THEME_DARK);
}

/* Initialise on DOMContentLoaded */
document.addEventListener('DOMContentLoaded', function () {
  /* Apply stored theme immediately */
  applyTheme(getSavedTheme());

  /* Bind every .theme-toggle button */
  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', toggleTheme);
  });
});

/* ==========================================================================
   §2  Mobile Menu Toggle
   Adds/removes .active on the hamburger and .mobile-nav overlay.
   Closes on link-click or outside-click.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');

  if (!hamburger || !mobileNav) {
    return;
  }

  /**
   * Opens or closes the mobile nav.
   * @param {boolean} open
   */
  function setMobileNav(open) {
    hamburger.classList.toggle('active', open);
    mobileNav.classList.toggle('active', open);
    hamburger.setAttribute('aria-expanded', String(open));

    /* Prevent body scroll while menu is open */
    document.body.style.overflow = open ? 'hidden' : '';
  }

  /* Toggle on hamburger click */
  hamburger.addEventListener('click', function () {
    const isOpen = mobileNav.classList.contains('active');
    setMobileNav(!isOpen);
  });

  /* Close when any mobile-nav link is clicked */
  mobileNav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      setMobileNav(false);
    });
  });

  /* Close when clicking outside the nav overlay */
  document.addEventListener('click', function (e) {
    const isOpen = mobileNav.classList.contains('active');
    if (!isOpen) {
      return;
    }
    const clickedInsideNav = mobileNav.contains(e.target);
    const clickedHamburger = hamburger.contains(e.target);
    if (!clickedInsideNav && !clickedHamburger) {
      setMobileNav(false);
    }
  });

  /* Close on Escape key */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
      setMobileNav(false);
      hamburger.focus();
    }
  });
});

/* ==========================================================================
   §3  Toast Notification
   Creates a short-lived popup at the bottom-right of the viewport.
   Types: 'success' (default) | 'error'
   ========================================================================== */

/** @type {HTMLElement | null} Active toast element for cleanup. */
let activeToast = null;

/** @type {number | null} Active toast removal timer. */
let toastTimer = null;

/**
 * Displays a toast notification.
 *
 * @param {string}  message             The text to display.
 * @param {Object}  [options]           Optional settings.
 * @param {number}  [options.duration]  How long to show (ms). Default 2000.
 * @param {'success' | 'error'} [options.type]  Visual style. Default 'success'.
 */
function showToast(message, options) {
  const opts = options || {};
  const duration = typeof opts.duration === 'number' ? opts.duration : 2000;
  const type = opts.type || 'success';

  /* Remove any existing toast first */
  if (activeToast) {
    activeToast.remove();
    clearTimeout(toastTimer);
    activeToast = null;
  }

  /* Build toast element */
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  /* Icon (checkmark for success, X for error) */
  const iconSvg =
    type === 'error'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  toast.innerHTML = iconSvg + '<span>' + message + '</span>';
  document.body.appendChild(toast);
  activeToast = toast;

  /* Trigger show animation on next frame */
  requestAnimationFrame(function () {
    toast.classList.add('visible');
  });

  /* Auto-hide after duration */
  toastTimer = setTimeout(function () {
    toast.classList.remove('visible');
    /* Remove from DOM after CSS transition finishes */
    setTimeout(function () {
      if (toast.parentNode) {
        toast.remove();
      }
      if (activeToast === toast) {
        activeToast = null;
      }
    }, 300);
  }, duration);
}

/* ==========================================================================
   §4  Copy to Clipboard
   Uses the modern Clipboard API with a fallback for older browsers.
   Shows a success/error toast automatically.
   ========================================================================== */

/**
 * Copies text to the system clipboard and shows a toast.
 *
 * @param {string} text  The string to copy.
 * @returns {Promise<void>}
 */
async function copyToClipboard(text) {
  /* Modern Clipboard API (requires HTTPS or localhost) */
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!', { type: 'success' });
      return;
    } catch (_) {
      /* Clipboard API rejected — fall through to legacy method */
    }
  }

  /* Fallback for HTTP or older browsers */
  fallbackCopy(text);
}

/**
 * Legacy textarea-based copy fallback.
 * @param {string} text
 */
function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const ok = document.execCommand('copy');
    showToast(
      ok ? 'Copied to clipboard!' : 'Copy failed — please copy manually.',
      { type: ok ? 'success' : 'error' }
    );
  } catch (err) {
    showToast('Copy failed — please copy manually.', { type: 'error' });
  }

  document.body.removeChild(textarea);
}

/* ==========================================================================
   §5  Textarea Auto-Resize
   Dynamically grows a <textarea> to fit its content up to a max-height.
   ========================================================================== */

/** @type {number} Maximum auto-resize height in pixels. */
const TEXTAREA_MAX_HEIGHT = 600;

/**
 * Adjusts the height of a textarea to fit its content.
 *
 * @param {HTMLTextAreaElement} textarea   The textarea element.
 * @param {number}             [maxHeight] Override the default max-height (px).
 */
function autoResizeTextarea(textarea, maxHeight) {
  const limit = typeof maxHeight === 'number' ? maxHeight : TEXTAREA_MAX_HEIGHT;

  /* Reset to auto so scrollHeight recalculates correctly */
  textarea.style.height = 'auto';

  const newHeight = Math.min(textarea.scrollHeight, limit);
  textarea.style.height = newHeight + 'px';

  /* Show scrollbar only when content exceeds max */
  textarea.style.overflowY = textarea.scrollHeight > limit ? 'auto' : 'hidden';
}

/**
 * Binds auto-resize behaviour to one or more textareas.
 * Call once per page after DOM is ready.
 *
 * @param {string} selector  CSS selector for the textareas.
 * @param {number} [maxHeight]
 */
function initAutoResize(selector, maxHeight) {
  document.querySelectorAll(selector).forEach(function (textarea) {
    textarea.addEventListener('input', function () {
      autoResizeTextarea(textarea, maxHeight);
    });
    /* Initial sizing */
    autoResizeTextarea(textarea, maxHeight);
  });
}

/* ==========================================================================
   §6  Format File Size
   Converts a byte count into a human-friendly string.
   ========================================================================== */

/** @type {string[]} Size unit labels in ascending order. */
const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/**
 * Formats a byte value into a readable string.
 *
 * @param {number} bytes  The number of bytes.
 * @returns {string}       e.g. "1.45 KB", "3.21 MB"
 */
function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0 B';
  }
  if (bytes === 0) {
    return '0 B';
  }

  let exponent = Math.floor(Math.log(bytes) / Math.log(1024));
  /* Clamp to the largest unit we have */
  exponent = Math.min(exponent, SIZE_UNITS.length - 1);

  const value = bytes / Math.pow(1024, exponent);
  const formatted = exponent === 0 ? value.toString() : value.toFixed(2);

  return formatted + ' ' + SIZE_UNITS[exponent];
}

/* ==========================================================================
   §7  Download as File
   Creates a Blob from content and triggers a browser download.
   ========================================================================== */

/**
 * Downloads a string as a file.
 *
 * @param {string} content   The file content.
 * @param {string} filename  The download filename (e.g. "data.json").
 * @param {string} [mimeType]  MIME type. Default 'text/plain'.
 */
function downloadAsFile(content, filename, mimeType) {
  /* Guard: prevent downloading empty/null content */
  if (content == null || content === '') {
    showToast('Nothing to download.', { type: 'error' });
    return;
  }

  const type = mimeType || 'text/plain';
  const blob = new Blob([content], { type: type });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  /* Cleanup */
  setTimeout(function () {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 100);
}

/* ==========================================================================
   §8  Debounce Utility
   Delays execution until the caller stops invoking for `delay` ms.
   Ideal for real-time formatting on keystroke.
   ========================================================================== */

/**
 * Creates a debounced version of a function.
 *
 * @param {Function} func   The function to debounce.
 * @param {number}   delay  Delay in milliseconds.
 * @returns {Function}       The debounced wrapper.
 */
function debounce(func, delay) {
  let timerId = null;

  return function debounced() {
    const context = this;
    const args = arguments;

    clearTimeout(timerId);
    timerId = setTimeout(function () {
      func.apply(context, args);
    }, delay);
  };
}

/* ==========================================================================
   §9  Misc Helpers (used across tool pages)
   ========================================================================== */

/**
 * Safely selects a DOM element — logs a warning (dev only) if missing.
 *
 * @param {string} selector  CSS selector.
 * @returns {HTMLElement | null}
 */
function qs(selector) {
  return document.querySelector(selector);
}

/**
 * Selects all matching DOM elements as an Array.
 *
 * @param {string} selector  CSS selector.
 * @returns {HTMLElement[]}
 */
function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

/**
 * Counts the number of characters, words, and lines in a string.
 *
 * @param {string} text
 * @returns {{ chars: number, words: number, lines: number }}
 */
function countTextStats(text) {
  const chars = text.length;
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const lines = text === '' ? 0 : text.split('\n').length;
  return { chars: chars, words: words, lines: lines };
}

/**
 * Escapes HTML entities to prevent XSS when inserting user content.
 *
 * @param {string} str  Raw user string.
 * @returns {string}     Escaped string safe for innerHTML.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ==========================================================================
   §10  Active Nav Link Highlighter
   Marks the nav link that matches the current path with .active class.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  let currentPath = window.location.pathname;

  /* Normalise: strip trailing slash unless root */
  if (currentPath !== '/' && currentPath.endsWith('/')) {
    currentPath = currentPath.slice(0, -1);
  }

  qsa('.nav-links a, .mobile-nav a').forEach(function (link) {
    let linkPath = link.getAttribute('href');

    if (!linkPath) {
      return;
    }

    /* Normalise link path the same way */
    if (linkPath !== '/' && linkPath.endsWith('/')) {
      linkPath = linkPath.slice(0, -1);
    }

    if (linkPath === currentPath) {
      link.classList.add('active');
    }
  });
});

/* ==========================================================================
   §11  Service Worker Registration
   Registers the SW only on production (HTTPS) to enable offline caching.
   ========================================================================== */

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      /* SW registration failed — site works fine without it */
    });
  });
}
