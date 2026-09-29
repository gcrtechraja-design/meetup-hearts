import { Auth, RecaptchaVerifier } from 'firebase/auth';

/**
 * Singleton state for managing reCAPTCHA verifiers across Web preview and Mobile environments.
 * Prevents both:
 * 1. "reCAPTCHA has already been rendered in this element"
 * 2. "reCAPTCHA client element has been removed: <widgetId>"
 */
interface VerifierInstance {
  verifier: RecaptchaVerifier;
  containerId: string;
  widgetId: number | null;
}

// Global registry of verifiers keyed by containerId
const verifierRegistry = new Map<string, VerifierInstance>();

/**
 * Ensures a valid container element exists in the DOM.
 * Never destroys or replaces parent nodes to prevent "reCAPTCHA client element has been removed".
 */
export const ensureRecaptchaContainer = (containerId: string = 'recaptcha-container'): HTMLElement => {
  if (typeof document === 'undefined') {
    throw new Error('Document is not defined');
  }

  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement('div');
    el.id = containerId;
    document.body.appendChild(el);
  }
  return el;
};

export const resetRecaptchaContainer = ensureRecaptchaContainer;

/**
 * Clears an existing reCAPTCHA verifier safely.
 */
export const clearRecaptchaVerifier = (containerId: string = 'recaptcha-container') => {
  const instance = verifierRegistry.get(containerId);
  if (instance) {
    try {
      instance.verifier.clear();
    } catch (e) {
      console.warn(`[reCAPTCHA] Notice while clearing verifier:`, e);
    }
    verifierRegistry.delete(containerId);
  }

  if (typeof window !== 'undefined') {
    if ((window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier.clear();
      } catch (e) {}
      (window as any).recaptchaVerifier = null;
    }
  }

  if (typeof document !== 'undefined') {
    const el = document.getElementById(containerId);
    if (el) {
      try {
        el.innerHTML = '';
      } catch (e) {}
    }
  }
};

/**
 * Gets the existing singleton RecaptchaVerifier or creates and initializes a new one.
 * Ensures the verifier is initialized only once per container and stays attached to the DOM.
 */
export const getOrCreateRecaptchaVerifier = async (
  auth: Auth,
  containerId: string = 'recaptcha-container',
  callbacks?: {
    onSuccess?: () => void;
    onExpired?: () => void;
  }
): Promise<RecaptchaVerifier> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('reCAPTCHA requires a browser or WebView environment.');
  }

  // Ensure container element exists in DOM
  const container = ensureRecaptchaContainer(containerId);

  // 1. Check if an active instance already exists in our registry
  const existing = verifierRegistry.get(containerId);
  if (existing && existing.verifier) {
    // Check if the container element is still connected to the DOM
    if (document.body.contains(container)) {
      (window as any).recaptchaVerifier = existing.verifier;
      return existing.verifier;
    }
    // Container was detached, clear stale verifier
    clearRecaptchaVerifier(containerId);
  }

  // 2. Clear previous global reference if any
  if ((window as any).recaptchaVerifier) {
    try {
      (window as any).recaptchaVerifier.clear();
    } catch (e) {}
    (window as any).recaptchaVerifier = null;
  }

  // Ensure container is clean
  container.innerHTML = '';

  // 3. Create fresh RecaptchaVerifier
  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      callbacks?.onSuccess?.();
    },
    'expired-callback': () => {
      console.warn(`[reCAPTCHA] Token expired for #${containerId}`);
      clearRecaptchaVerifier(containerId);
      callbacks?.onExpired?.();
    },
  });

  const instanceState: VerifierInstance = {
    verifier,
    containerId,
    widgetId: null,
  };

  // 4. Render and cache
  try {
    const widgetId = await verifier.render();
    instanceState.widgetId = widgetId;
  } catch (err: any) {
    const errMsg = String(err?.message || '');
    if (errMsg.includes('already been rendered')) {
      console.warn(`[reCAPTCHA] Container #${containerId} already rendered, reusing.`);
    } else {
      console.warn(`[reCAPTCHA] Render notice for #${containerId}:`, err);
    }
  }

  verifierRegistry.set(containerId, instanceState);
  (window as any).recaptchaVerifier = verifier;

  return verifier;
};
