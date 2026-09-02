// Trigger the flash via a data attribute (see card-glow.css). A class would be wiped whenever React
// reconciles the element's className on re-render; an attribute React does not manage survives.
const GLOW_ATTR = 'data-highlight-flash';

const triggerGlow = (el: HTMLElement) => {
  requestAnimationFrame(() => {
    const cleanup = () => el.removeAttribute(GLOW_ATTR);

    if (el.hasAttribute(GLOW_ATTR)) {
      cleanup();
      void el.offsetWidth; // Force reflow before re-adding so a repeat glow restarts
    }

    el.setAttribute(GLOW_ATTR, '');
    el.addEventListener('animationend', cleanup, { once: true });
    el.addEventListener('animationcancel', cleanup, { once: true });
  });
};

export const triggerSectionGlow = (type: 'iced' | 'accepted', projectId: string) => {
  const id = `section-${type}-${projectId}`;
  // Element may not be in DOM yet after optimistic update, retry once after a frame.
  const attempt = () => {
    const el = document.getElementById(id);
    if (el) triggerGlow(el);
  };
  if (document.getElementById(id)) attempt();
  else requestAnimationFrame(attempt);
};

export const triggerTaskGlow = (taskId: string) => {
  const el = document.getElementById(taskId);
  if (!el || el.hasAttribute('data-suppress-glow')) return;

  // Defer glow until card leaves editing state (description saves happen while editing)
  if (el.dataset.state === 'editing') {
    const observer = new MutationObserver(() => {
      if (el.dataset.state !== 'editing') {
        observer.disconnect();
        triggerGlow(el);
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-state'] });
    return;
  }

  triggerGlow(el);
};
