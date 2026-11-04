// A data attribute (see card-glow.css): a class would be wiped whenever React reconciles the element's className
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
    // Only animationend: the restart above queues an animationcancel that is dispatched once the attribute is
    // back on, so cleaning up on it would strip the run that just started and leave no glow at all.
    el.addEventListener('animationend', cleanup, { once: true });
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

/** A card still being typed in: a description save lands mid-edit, and a flash under the open editor distracts. */
const isBeingEdited = (el: HTMLElement) => el.dataset.state === 'editing' && el.contains(document.activeElement);

/** A card scrolled to, or swapped out by a list re-render, mounts a frame or two later, and a glow needs its element. */
const mountFrames = 10;

export const triggerTaskGlow = (taskId: string, framesLeft = mountFrames) => {
  const el = document.getElementById(taskId);
  if (!el) return framesLeft > 0 ? void requestAnimationFrame(() => triggerTaskGlow(taskId, framesLeft - 1)) : undefined;
  if (el.hasAttribute(suppressGlowAttr)) return;
  if (!isBeingEdited(el)) return triggerGlow(el);

  // A touch tap outside a card leaves it in `editing`, so waiting on that state alone would hold the glow back
  // for as long as the card stays open: focus leaving ends the edit just as much.
  const observer = new MutationObserver(() => glowOnceEdited());
  // focusout runs before the new focus lands, so the check waits a frame for it
  const onFocusOut = () => requestAnimationFrame(glowOnceEdited);

  const glowOnceEdited = () => {
    if (isBeingEdited(el)) return;
    observer.disconnect();
    el.removeEventListener('focusout', onFocusOut);
    triggerGlow(el);
  };

  observer.observe(el, { attributes: true, attributeFilter: ['data-state'] });
  el.addEventListener('focusout', onFocusOut);
};
