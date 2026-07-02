const triggerGlow = (el: HTMLElement, className: string) => {
  requestAnimationFrame(() => {
    const cleanup = () => el.classList.remove(className);

    if (el.classList.contains(className)) {
      cleanup();
      void el.offsetWidth; // Force reflow before re-adding
    }

    el.classList.add(className);
    el.addEventListener('animationend', cleanup, { once: true });
    el.addEventListener('animationcancel', cleanup, { once: true });
  });
};

export const triggerSectionGlow = (type: 'iced' | 'accepted', projectId: string) => {
  const id = `section-${type}-${projectId}`;
  // Element may not be in DOM yet after optimistic update — retry once after a frame
  const attempt = () => {
    const el = document.getElementById(id);
    if (el) triggerGlow(el, 'animate-highlight-flash');
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
        triggerGlow(el, 'animate-highlight-flash');
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-state'] });
    return;
  }

  triggerGlow(el, 'animate-highlight-flash');
};
