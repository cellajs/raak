// Trigger the flash via a data attribute (see card-glow.css). A class would be wiped whenever React
// reconciles the element's className on re-render; an attribute React does not manage survives.
const glowAttr = 'data-highlight-flash';

/** Set on a board card to skip its glow, as the open task sheet shows the same task. */
export const suppressGlowAttr = 'data-suppress-glow';

const triggerGlow = (el: HTMLElement) => {
  requestAnimationFrame(() => {
    const cleanup = () => el.removeAttribute(glowAttr);

    if (el.hasAttribute(glowAttr)) {
      cleanup();
      void el.offsetWidth; // Force reflow before re-adding so a repeat glow restarts
    }

    el.setAttribute(glowAttr, '');
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
  if (!el || el.hasAttribute(suppressGlowAttr)) return;

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
